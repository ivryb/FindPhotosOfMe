import subprocess
import sys
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import create_app
from endpoints import photo_batches
from endpoints.search_photos import process_search
from services.face_index import Faces, batch_key, index_key

FACE = [{'embedding': [1.0, 0.0], 'gender': 0}]


def test_http_requires_token_and_submits_without_waiting(monkeypatch):
    monkeypatch.setenv('SERVICE_TOKEN', 'test-service-token')
    calls = []

    async def submit(*args):
        calls.append(args)

    client = TestClient(create_app(submit_batch=submit, submit_merge=submit, execute_search=submit))
    headers = {'Authorization': 'Bearer test-service-token'}
    assert client.post('/api/process-batch', json={'batch_id': 'batch'}).status_code == 401
    assert calls == []
    assert client.post('/api/process-batch', json={'batch_id': 'batch'}, headers=headers).status_code == 202
    assert client.post('/api/merge-faces', json={'collection_id': 'event', 'batch_ids': ['b1']}, headers=headers).status_code == 202
    assert client.post('/api/process-batch', json={}, headers=headers).status_code == 422
    assert calls == [('batch',), ('event', ['b1'])]
    response = client.post('/api/search-photos', headers=headers,
                           data={'search_request_id': 'search'},
                           files={'reference_photo': ('selfie.jpg', b'image', 'image/jpeg')})
    assert response.status_code == 200
    assert calls[-1] == ('search', b'image')
    assert client.post('/api/search-photos', headers=headers, data={'search_request_id': 'search'},
                       files={'reference_photo': ('x.jpg', b'x' * (10 * 1024**2 + 1), 'image/jpeg')}).status_code == 413


def test_the_web_endpoint_loads_without_numpy_or_the_face_model():
    # Modal's web endpoint runs on a small image; importing numpy there took search and uploads down.
    code = "import sys; sys.modules['numpy'] = None; sys.modules['cv2'] = None; import main"
    result = subprocess.run([sys.executable, "-c", code], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


@pytest.fixture
def backend(monkeypatch):
    state = {
        'objects': {'uploads/event/up/a.jpg': b'face', 'uploads/event/up/b.jpg': b'no face'},
        'batch': {'collectionId': 'event', 'status': 'running', 'attempt': 1, 'photos': [
            {'name': 'a.jpg', 'source': 'uploads/event/up/a.jpg', 'key': 'event/tag-a.jpg'},
            {'name': 'b.jpg', 'source': 'uploads/event/up/b.jpg', 'key': 'event/tag-b.jpg'},
        ]},
        'completed': [], 'failed': [], 'merged': [], 'fail_copy': False,
        'collection': {'imagesCount': 1},
        'search': {'collectionId': 'event', 'status': 'pending', 'imagesFound': []},
    }
    objects = state['objects']

    class Storage:
        def download_file(self, key): return objects.get(key)
        def upload_file(self, data, key, content_type):
            objects[key] = data
            return True
        def copy_file(self, source, key):
            if state['fail_copy']: return False
            objects[key] = objects[source]
            return True
        def delete_files(self, keys):
            for key in keys: objects.pop(key, None)
        def list_objects(self, prefix): return [{'Key': key} for key in sorted(objects) if key.startswith(prefix)]

    class Convex:
        def get_batch(self, _): return state['batch']
        def complete_batch(self, batch_id, saved, saved_bytes):
            state['batch']['status'] = 'done'
            state['completed'].append((batch_id, saved, saved_bytes))
        def fail_batch(self, batch_id, attempt): state['failed'].append((batch_id, attempt))
        def faces_merged(self, collection_id, batch_ids): state['merged'].append((collection_id, batch_ids))
        def get_collection(self, _): return state['collection']
        def get_search_request(self, _): return state['search']
        def update_search_request(self, _, status, **kwargs): state['search'].update(status=status, **kwargs)

    class FaceService:
        def extract_embeddings(self, data): return FACE if data == b'face' else []

    module = types.ModuleType('services.face_recognition_service')
    module.get_face_service = lambda: FaceService()
    monkeypatch.setitem(sys.modules, module.__name__, module)
    monkeypatch.setattr(photo_batches, 'make_thumbnail', lambda data: b'small-' + data)
    for target in (photo_batches, sys.modules['endpoints.search_photos']):
        monkeypatch.setattr(target, 'R2StorageService', Storage)
        monkeypatch.setattr(target, 'ConvexService', Convex)
    return state


def test_batch_keeps_photos_with_faces_and_clears_the_uploads(backend):
    photo_batches.process_batch('b1')
    objects = backend['objects']
    assert objects['event/tag-a.jpg'] == b'face'
    assert objects['event/thumbs/tag-a.jpg'] == b'small-face'
    assert 'event/tag-b.jpg' not in objects
    assert not [key for key in objects if key.startswith('uploads/')]
    assert Faces.decode(objects[batch_key('event', 'b1')]).names.tolist() == ['tag-a.jpg']
    # One photo of 4 bytes and its thumbnail of 10 bytes
    assert backend['completed'] == [('b1', ['a.jpg'], 14)]


def test_a_batch_that_already_has_a_result_is_left_alone(backend):
    backend['batch']['status'] = 'done'
    photo_batches.process_batch('b1')
    assert backend['completed'] == []
    assert 'uploads/event/up/a.jpg' in backend['objects']


def test_a_batch_another_worker_already_finished_is_left_alone(backend):
    photo_batches.process_batch('b1')
    # The same batch was also given to a second worker, which runs after the first cleared the uploads.
    backend['batch']['status'] = 'running'
    faces_file = backend['objects'][batch_key('event', 'b1')]
    assert photo_batches.process_batch('b1')['skipped']
    assert backend['objects'][batch_key('event', 'b1')] == faces_file
    assert len(backend['completed']) == 1


def test_a_failed_batch_keeps_its_uploads_and_asks_to_be_retried(backend):
    backend['fail_copy'] = True
    with pytest.raises(RuntimeError):
        photo_batches.process_batch('b1')
    assert backend['failed'] == [('b1', 1)]
    assert backend['completed'] == []
    assert 'uploads/event/up/a.jpg' in backend['objects']


def test_merge_folds_batch_files_into_the_index_and_can_run_again(backend):
    objects = backend['objects']
    objects[index_key('event')] = Faces.of({'old.jpg': FACE, 'x.jpg': FACE}).encode()
    # x.jpg is in the index already: a merge whose result was lost is running again.
    objects[batch_key('event', 'b1')] = Faces.of({'x.jpg': FACE, 'y.jpg': FACE}).encode()

    photo_batches.merge_faces('event', ['b1', 'b2'])
    photo_batches.merge_faces('event', ['b1', 'b2'])
    assert sorted(Faces.decode(objects[index_key('event')]).names.tolist()) == ['old.jpg', 'x.jpg', 'y.jpg']
    assert batch_key('event', 'b1') not in objects
    assert backend['merged'] == [('event', ['b1', 'b2'])] * 2


def test_search_reads_the_index_and_unmerged_batches_and_counts_each_photo_once(backend):
    objects = backend['objects']
    objects[index_key('event')] = Faces.of({'tag-a.jpg': FACE, 'other.jpg': [{'embedding': [0.0, 1.0], 'gender': 0}]}).encode()
    objects[batch_key('event', 'b1')] = Faces.of({'tag-a.jpg': FACE, 'tag-c.jpg': [{'embedding': [1.0, 0.0], 'gender': 1}]}).encode()
    assert process_search('search', b'face')['matches'] == 1
    assert backend['search']['status'] == 'complete'
    assert backend['search']['images_found'] == ['event/tag-a.jpg']


def test_no_face_search_sets_error_instead_of_staying_processing(backend):
    with pytest.raises(ValueError, match='No face'):
        process_search('search', b'not-a-face')
    assert backend['search']['status'] == 'error'
    assert backend['search']['error'] == 'no_face'


def test_other_search_failures_are_reported_as_failed(backend):
    backend['collection']['expiresAt'] = 0
    with pytest.raises(ValueError):
        process_search('search', b'face')
    assert backend['search']['error'] == 'failed'


def test_faces_match_by_likeness_and_gender_best_first():
    faces = Faces.of({
        'close.jpg': [{'embedding': [1.0, 0.1], 'gender': 0}],
        'exact.jpg': [{'embedding': [2.0, 0.0], 'gender': 0}],
        'other-gender.jpg': [{'embedding': [1.0, 0.0], 'gender': 1}],
        'different.jpg': [{'embedding': [0.0, 1.0], 'gender': 0}],
    })
    assert [name for name, _ in faces.match([1.0, 0.0], 0)] == ['exact.jpg', 'close.jpg']
    assert Faces.empty().match([1.0, 0.0], 0) == []


def test_crowdsourced_batch_keeps_scenery_but_indexes_only_faces(backend):
    backend['batch']['keepAllPhotos'] = True
    photo_batches.process_batch('b1')
    objects = backend['objects']
    assert objects['event/tag-b.jpg'] == b'no face'
    assert objects['event/thumbs/tag-b.jpg'] == b'small-no face'
    assert Faces.decode(objects[batch_key('event', 'b1')]).names.tolist() == ['tag-a.jpg']
    assert backend['completed'] == [('b1', ['a.jpg', 'b.jpg'], 34)]
    assert not [key for key in objects if key.startswith('uploads/')]


@pytest.mark.parametrize('unreadable', [b'', b'not an image'])
def test_corrupt_guest_photo_does_not_drop_the_valid_photos_in_its_batch(backend, monkeypatch, unreadable):
    cv2 = pytest.importorskip('cv2')
    import numpy as np
    from services.thumbnails import make_thumbnail

    ok, encoded = cv2.imencode('.jpg', np.zeros((8, 8, 3), dtype=np.uint8))
    assert ok
    valid_photo = encoded.tobytes()
    backend['batch']['keepAllPhotos'] = True
    objects = backend['objects']
    objects['uploads/event/up/a.jpg'] = valid_photo
    objects['uploads/event/up/b.jpg'] = unreadable
    monkeypatch.setattr(photo_batches, 'make_thumbnail', make_thumbnail)

    assert photo_batches.process_batch('b1') == {'ok': True, 'saved': 1}
    assert objects['event/tag-a.jpg'] == valid_photo
    thumbnail = objects['event/thumbs/tag-a.jpg']
    assert thumbnail[8:12] == b'WEBP'
    assert 'event/tag-b.jpg' not in objects
    assert 'event/thumbs/tag-b.jpg' not in objects
    assert not [key for key in objects if key.startswith('uploads/')]
    assert backend['completed'] == [('b1', ['a.jpg'], len(valid_photo) + len(thumbnail))]
    assert backend['failed'] == []

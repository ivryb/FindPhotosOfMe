import io
import json
import sys
import types
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import create_app
from endpoints import upload_collection as ingest
from endpoints.search_photos import process_search


def test_http_requires_token_and_submits_without_waiting(monkeypatch):
    monkeypatch.setenv('SERVICE_TOKEN', 'test-service-token')
    calls = []

    async def submit(*args):
        calls.append(args)

    client = TestClient(create_app(submit_ingest=submit, execute_search=submit))
    headers = {'Authorization': 'Bearer test-service-token'}
    body = {'job_id': 'job', 'collection_id': 'event', 'file_key': 'upload.zip'}
    assert client.post('/api/process-ingest-job', json=body).status_code == 401
    assert calls == []
    assert client.post('/api/process-ingest-job', json=body, headers=headers).status_code == 202
    assert calls == [('job', 'event', 'upload.zip')]
    assert client.post('/api/process-ingest-job', json={}, headers=headers).status_code == 422
    response = client.post('/api/search-photos', headers=headers,
                           data={'search_request_id': 'search'},
                           files={'reference_photo': ('selfie.jpg', b'image', 'image/jpeg')})
    assert response.status_code == 200
    assert response.json()['search_request_id'] == 'search'
    assert calls[-1] == ('search', b'image')
    assert client.post('/api/search-photos', headers=headers, data={'search_request_id': 'search'},
                       files={'reference_photo': ('x.jpg', b'x' * (10 * 1024**2 + 1), 'image/jpeg')}).status_code == 413
    assert len(calls) == 2


@pytest.fixture
def backend(monkeypatch):
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, 'w') as z:
        z.writestr('folder/photo.jpg', b'face')
        z.writestr('other/photo.jpg', b'face')
    state = {
        'job': {'collectionId': 'event', 'fileKey': 'upload.zip', 'status': 'running'},
        'collection': {'status': 'complete', 'imagesCount': 0},
        'search': {'collectionId': 'event', 'status': 'pending', 'imagesFound': []},
        'objects': {'upload.zip': archive.getvalue()}, 'delete_count': 0,
        'fail_index': False, 'complete_count': 0, 'reserved': [], 'completed': None, 'refuse_reservation': False,
    }

    class Storage:
        def download_file(self, key): return state['objects'].get(key)
        def download_to_file(self, key, path, *, max_bytes): path.write_bytes(state['objects'][key])
        def upload_file(self, data, key, content_type):
            if state['fail_index'] and key.endswith('embeddings.json'): return False
            state['objects'][key] = data
            return True
        def delete_file(self, key):
            state['objects'].pop(key, None)
            state['delete_count'] += 1

    class Convex:
        def get_ingest_job(self, _): return state['job']
        def get_collection(self, _): return state['collection']
        def update_ingest_progress(self, _, **kwargs): state['job'].update(kwargs)
        def update_collection_status(self, _, status, images_count=None):
            state['collection']['status'] = status
            if images_count is not None: state['collection']['imagesCount'] = images_count
        def set_collection_preview_images(self, _, previews): state['previews'] = previews
        def reserve_ingest(self, _, images):
            if state['refuse_reservation']: raise RuntimeError('This ZIP has 2 photos, but your balance is $0')
            state['reserved'].append(images)
        def mark_ingest_completed(self, _, count, saved_images, saved_bytes):
            state['job']['status'] = 'completed'
            state['complete_count'] += 1
            state['completed'] = (count, saved_images, saved_bytes)
        def mark_ingest_failed(self, _, error): state['job']['status'] = 'failed'
        def get_search_request(self, _): return state['search']
        def update_search_request(self, _, status, **kwargs): state['search'].update(status=status, **kwargs)

    class Faces:
        def extract_embeddings(self, data):
            return [{'embedding': [1.0, 0.0], 'gender': 0}] if data == b'face' else []
        def find_matching_faces(self, *args): return [('job-photo.jpg', 1.0)]

    module = types.ModuleType('services.face_recognition_service')
    module.get_face_service = lambda: Faces()
    monkeypatch.setitem(sys.modules, module.__name__, module)
    monkeypatch.setattr(ingest, 'make_thumbnail', lambda data: b'small-' + data)
    monkeypatch.setattr(ingest, 'R2StorageService', Storage)
    monkeypatch.setattr(ingest, 'ConvexService', Convex)
    monkeypatch.setattr('endpoints.search_photos.R2StorageService', Storage)
    monkeypatch.setattr('endpoints.search_photos.ConvexService', Convex)
    return state


def test_ingest_saves_index_before_deleting_source_and_completed_replay_is_noop(backend):
    result = ingest.process_ingest_job('job', 'event', 'upload.zip')
    assert result['matchedImages'] == 2
    index = json.loads(backend['objects']['event/embeddings.json'])
    assert set(index) == {'job-photo.jpg', 'job-photo-1.jpg'}
    assert backend['collection']['imagesCount'] == 2
    assert backend['job']['status'] == 'completed'
    assert 'upload.zip' not in backend['objects']
    ingest.process_ingest_job('job', 'event', 'upload.zip')
    assert backend['complete_count'] == 1
    assert backend['delete_count'] == 1


def test_ingest_reserves_photos_first_and_saves_a_thumbnail_next_to_each_kept_photo(backend):
    ingest.process_ingest_job('job', 'event', 'upload.zip')
    assert backend['reserved'] == [2]
    assert backend['objects']['event/thumbs/job-photo.jpg'] == b'small-face'
    assert backend['objects']['event/thumbs/job-photo-1.jpg'] == b'small-face'
    # Two photos of 4 bytes and two thumbnails of 10 bytes
    assert backend['completed'] == (2, 2, 28)


def test_ingest_saves_nothing_when_the_balance_cannot_cover_the_zip(backend):
    backend['refuse_reservation'] = True
    with pytest.raises(RuntimeError, match='balance'):
        ingest.process_ingest_job('job', 'event', 'upload.zip')
    assert backend['job']['status'] == 'failed'
    assert list(backend['objects']) == ['upload.zip']


def test_failed_index_preserves_source_and_can_be_retried(backend):
    backend['fail_index'] = True
    with pytest.raises(RuntimeError, match='face index'):
        ingest.process_ingest_job('job', 'event', 'upload.zip')
    assert backend['job']['status'] == 'failed'
    assert backend['collection']['status'] == 'error'
    assert 'upload.zip' in backend['objects']
    assert backend['delete_count'] == 0
    backend['fail_index'] = False
    backend['job']['status'] = 'running'
    ingest.process_ingest_job('job', 'event', 'upload.zip')
    assert backend['collection']['imagesCount'] == 2
    # The retry overwrites the photos and thumbnails it saved before failing instead of adding copies.
    saved = [key for key in backend['objects'] if key.endswith('.jpg')]
    assert sorted(saved) == ['event/job-photo-1.jpg', 'event/job-photo.jpg', 'event/thumbs/job-photo-1.jpg', 'event/thumbs/job-photo.jpg']


def test_replay_after_index_write_keeps_other_archives(backend):
    face = [{'embedding': [1, 0], 'gender': 0}]
    backend['objects']['event/embeddings.json'] = json.dumps({'job-photo.jpg': face, 'earlier.jpg': face}).encode()
    ingest.process_ingest_job('job', 'event', 'upload.zip')
    assert backend['collection']['imagesCount'] == 3
    assert 'earlier.jpg' in json.loads(backend['objects']['event/embeddings.json'])


def test_wrong_collection_rejected_without_changing_job(backend):
    with pytest.raises(ValueError, match='does not match'):
        ingest.process_ingest_job('job', 'other-event', 'upload.zip')
    assert backend['job']['status'] == 'running'
    assert len(backend['objects']) == 1


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


def test_search_publishes_results_to_convex(backend):
    backend['objects']['event/embeddings.json'] = b'{"job-photo.jpg": []}'
    assert process_search('search', b'face')['matches'] == 1
    assert backend['search']['status'] == 'complete'
    assert backend['search']['images_found'] == ['event/job-photo.jpg']


def test_archive_limits_checked_before_decoding(monkeypatch):
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as archive:
        archive.writestr('photo.jpg', b'12345')
    monkeypatch.setattr(ingest, 'MAX_IMAGE_BYTES', 4)
    with zipfile.ZipFile(data) as archive, pytest.raises(ValueError, match='50 MB'):
        ingest.image_entries(archive)


def test_lost_completion_response_does_not_corrupt_completed_event(backend, monkeypatch):
    original = ingest.ConvexService.mark_ingest_completed
    def complete_then_disconnect(self, *args):
        original(self, *args)
        raise ConnectionError('response lost')
    monkeypatch.setattr(ingest.ConvexService, 'mark_ingest_completed', complete_then_disconnect)
    assert ingest.process_ingest_job('job', 'event', 'upload.zip')['status'] == 'completed'
    assert backend['collection']['status'] == 'complete'
    assert backend['job']['status'] == 'completed'
    assert 'upload.zip' in backend['objects']

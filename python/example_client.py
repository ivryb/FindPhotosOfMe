"""Submit an existing Convex job; completion is observed in Convex."""

import argparse
import os
import requests
from dotenv import load_dotenv

load_dotenv()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('job_id')
parser.add_argument('collection_id')
parser.add_argument('file_key')
parser.add_argument('--url', default='http://localhost:8000')
args = parser.parse_args()
response = requests.post(
    f'{args.url.rstrip("/")}/api/process-ingest-job',
    headers={'Authorization': f'Bearer {os.environ["SERVICE_TOKEN"]}'},
    json={'job_id': args.job_id, 'collection_id': args.collection_id, 'file_key': args.file_key},
    timeout=60,
)
response.raise_for_status()
print(response.json())
print('Accepted. Read job progress and completion from Convex.')

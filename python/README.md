# Face Recognition Photo Filter with Cloudflare R2

This Python application filters photos based on face recognition, now with Cloudflare R2 cloud storage support.

## Features

- Face detection and recognition using InsightFace
- Gender-aware matching
- Configurable similarity threshold
- **NEW**: Cloudflare R2 storage integration (S3-compatible)
- Fallback to local filesystem processing
- Parallel processing for improved performance

## Setup

### 1. Install Dependencies

```bash
cd python
pip install -r requirements.txt
```

### 2. Configure Cloudflare R2

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and fill in your Cloudflare R2 credentials:

```env
USE_R2=true
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
```

#### Getting R2 Credentials

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **R2** → **Overview**
3. Create a new R2 bucket if you haven't already
4. Go to **R2** → **Manage R2 API Tokens**
5. Create a new API token with read/write permissions
6. Note down your:
   - Account ID
   - Access Key ID
   - Secret Access Key

### 3. Prepare Your Photos

#### Using R2 Storage

Upload your photos to R2:
- Reference photo: Upload to the root or specify path in `R2_REFERENCE_PHOTO`
- Input photos: Upload to a folder (e.g., `input/`) and set `R2_INPUT_PREFIX=input`

You can use the AWS CLI (configured for R2) or the Cloudflare dashboard to upload files.

#### Using Local Storage

Set `USE_R2=false` in `.env` and place photos in local folders:
- Reference photo: `ref.jpg` in the python directory
- Input photos: `all/` directory
- Output will be saved to: `filtered/` directory

## Usage

### Run with R2 Storage

```bash
python main.py
```

The application will:
1. Load the reference photo from R2
2. Download and process all photos from the input prefix
3. Upload matched photos to the output prefix
4. Display statistics

### Run with Local Storage

Set `USE_R2=false` in `.env`, then:

```bash
python main.py
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `USE_R2` | `false` | Enable R2 storage (`true`) or use local filesystem (`false`) |
| `R2_ACCOUNT_ID` | - | Your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | - | R2 API access key |
| `R2_SECRET_ACCESS_KEY` | - | R2 API secret key |
| `R2_BUCKET_NAME` | - | R2 bucket name |
| `R2_INPUT_PREFIX` | `input` | Folder in R2 containing photos to process |
| `R2_OUTPUT_PREFIX` | `output` | Folder in R2 where matched photos will be saved |
| `R2_REFERENCE_PHOTO` | `ref.jpg` | Key/path to reference photo in R2 |

## How It Works

### R2StorageManager Class

Handles all interactions with Cloudflare R2:
- `list_objects(prefix)`: Lists all objects with a given prefix
- `download_object_to_memory(key)`: Downloads an object to memory
- `upload_from_memory(data, key)`: Uploads data from memory to R2

### PhotoFilter Class

Processes photos with face recognition:
- `process_photos_from_r2()`: Processes photos from R2 storage
- `process_photos()`: Processes photos from local filesystem
- Face similarity threshold: 0.6 (can be adjusted in code)

## Migration from GCS

This application was refactored from Google Cloud Storage (GCS) to Cloudflare R2. Key changes:

1. **Storage Backend**: Replaced `google-cloud-storage` with `boto3` (S3-compatible)
2. **Authentication**: Now uses R2 API tokens instead of GCS service accounts
3. **Endpoint**: Uses R2-specific endpoint URL
4. **API Compatibility**: Leverages S3-compatible API for seamless integration

## Performance

- Uses in-memory processing to avoid disk I/O
- Processes photos sequentially (can be optimized with multiprocessing)
- Efficient bandwidth usage with R2's free egress

## Troubleshooting

### Authentication Errors

Make sure your R2 credentials are correct and the API token has the necessary permissions.

### Missing Photos

Verify the `R2_INPUT_PREFIX` matches the folder structure in your R2 bucket.

### Slow Processing

Consider adjusting the batch size or implementing parallel processing for large datasets.

## License

MIT

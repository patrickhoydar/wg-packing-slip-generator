# Correct Endpoint Usage

## Wrong (what you're currently using):
```bash
POST http://localhost:3001/customers/GEORGIA_BAPTIST/generate-pdfs
```

## Correct (what you should use):
```bash
POST http://localhost:3001/customers/GEORGIA_BAPTIST/generate-pdfs-chunked
```

## Request Body:
```json
{
  "kits": [...your kits array...],
  "chunkSize": 100
}
```

## Expected Response (from new endpoint):
```json
{
  "success": true,
  "message": "Generated 1000 of 1000 PDFs",
  "data": {
    "totalRequested": 1000,
    "totalGenerated": 1000,
    "outputDirectory": "/path/to/generated-packing-slips/GEORGIA_BAPTIST-2025-07-23T16-19-44",
    "chunks": [...],
    "instructions": "PDFs have been saved to the local directory..."
  }
}
```

## What happens with each endpoint:

### Old endpoint (`generate-pdfs`):
- ❌ Creates temp directory in `/var/folders/...`
- ❌ Tries to merge all PDFs into one file
- ❌ Browser crashes with large batches
- ❌ Files get deleted after processing

### New endpoint (`generate-pdfs-chunked`):
- ✅ Creates permanent directory in `generated-packing-slips/`
- ✅ Saves individual PDF files
- ✅ Processes in stable chunks of 100
- ✅ Files remain accessible after processing
---
name: Object Storage migration
description: How image uploads are stored and served using Replit Object Storage (GCS)
---

## Architecture

Images are stored in Google Cloud Storage via Replit Object Storage (bucket: replit-objstore-3f25c871-c50b-45a1-852b-6d3565b4bbdf).

### Upload flow (two-step presigned URL)
1. Client POSTs JSON metadata to `POST /api/storage/uploads/request-url` → gets `{ uploadURL, objectPath }`
2. Client PUTs file bytes directly to GCS presigned URL (no backend in the middle)
3. Client stores `objectPath` (e.g. `/objects/uploads/some-uuid`) in DB / sends via WS

### Serving URL
- `objectPath` = `/objects/uploads/<uuid>`  
- Serving URL = `/api/storage/objects/uploads/<uuid>` = `/api/storage` + `objectPath`
- This is what gets stored in DB and displayed in `<img src=...>`

### Server files
- `artifacts/api-server/src/lib/objectStorage.ts` — GCS client wrapper (copied from skill template, one type fix: `response.json() as { signed_url: string }`)
- `artifacts/api-server/src/lib/objectAcl.ts` — ACL framework
- `artifacts/api-server/src/routes/storage.ts` — route handlers

### Frontend
- `artifacts/chat-app/src/hooks/useImageUpload.ts` — rewritten to use presigned URL flow; normalizeContentType() resolves MIME from file extension for browsers that send empty MIME

### Legacy
- `POST /api/upload/image` (multer/diskStorage → `artifacts/api-server/uploads/`) kept for backward compat
- `/uploads/*` still served by express.static and routed in artifact.toml
- artifact.toml paths: `["/api", "/ws", "/uploads", "/storage"]`

**Why:** Local disk files disappear on every production deployment. GCS is permanent.

**How to apply:** All new image uploads go to GCS. Old DB rows with `/uploads/...` URLs still work during dev (files exist on disk) but will break in production after next deploy — acceptable since those are test images.

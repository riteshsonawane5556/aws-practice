from datetime import datetime
from pydantic import BaseModel, field_validator


ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


# ── Step 1: Frontend requests a presigned upload URL ──────────────────────────

class GenerateUploadUrlRequest(BaseModel):
    """
    Sent by the frontend before uploading.
    Backend uses this to generate a presigned PUT URL and reserve an S3 key.
    """
    filename: str
    content_type: str
    file_size: int  # bytes

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        if v not in ALLOWED_CONTENT_TYPES:
            raise ValueError(
                f"'{v}' is not allowed. Accepted: {sorted(ALLOWED_CONTENT_TYPES)}"
            )
        return v

    @field_validator("file_size")
    @classmethod
    def validate_file_size(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("file_size must be greater than 0.")
        if v > MAX_FILE_SIZE_BYTES:
            raise ValueError(
                f"File too large. Maximum: {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
            )
        return v


class GenerateUploadUrlResponse(BaseModel):
    """
    Returned to the frontend after generating the presigned upload URL.

    The frontend must:
      1. PUT the file bytes directly to `upload_url`
      2. Include the header: Content-Type: <content_type>
      3. After a successful PUT (HTTP 200 from S3), call POST /images/confirm-upload
         with the s3_key and metadata.

    The upload_url expires in `expires_in` seconds — the frontend must complete
    the PUT before then.
    """
    s3_key: str       # The key the object will have in S3 — pass this to confirm-upload
    upload_url: str   # Presigned PUT URL — frontend PUTs the file bytes here
    expires_in: int   # Seconds until upload_url expires (default: 300)


# ── Step 2: Frontend confirms upload and saves metadata ───────────────────────

class ConfirmUploadRequest(BaseModel):
    """
    Sent by the frontend after successfully PUTting the file to S3.
    Backend verifies the object exists in S3, then creates the DB record.
    """
    original_filename: str
    s3_key: str        # Returned by generate-upload-url — must match exactly
    content_type: str
    file_size: int     # bytes


# ── Read responses ─────────────────────────────────────────────────────────────

class ImageUploadResponse(BaseModel):
    """Returned after confirm-upload. Includes a presigned GET URL for immediate use."""
    id: int
    original_filename: str
    s3_key: str
    content_type: str
    file_size: int
    created_at: datetime
    presigned_url: str  # GET presigned URL, valid for PRESIGNED_URL_EXPIRY seconds

    model_config = {"from_attributes": True}


class ImageMetadata(BaseModel):
    """Used in list responses. No presigned URL — generating one per item is slow."""
    id: int
    original_filename: str
    s3_key: str
    content_type: str
    file_size: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ImageDetailResponse(ImageMetadata):
    """Single-image response. Adds a fresh presigned GET URL."""
    presigned_url: str


class DeleteResponse(BaseModel):
    message: str
    id: int

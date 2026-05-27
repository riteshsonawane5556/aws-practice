from datetime import datetime
from pydantic import BaseModel


class ImageUploadResponse(BaseModel):
    """Returned after a successful upload. Includes a fresh presigned URL."""
    id: int
    original_filename: str
    s3_key: str
    content_type: str
    file_size: int
    created_at: datetime
    presigned_url: str  # Valid for `presigned_url_expiry` seconds

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
    """Single-image response. Adds a fresh presigned URL to the base metadata."""
    presigned_url: str


class DeleteResponse(BaseModel):
    message: str
    id: int

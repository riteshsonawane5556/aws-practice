from datetime import datetime
from pydantic import BaseModel


class ImageUploadResponse(BaseModel):
    id: int
    original_filename: str
    s3_key: str
    content_type: str
    file_size: int
    created_at: datetime
    presigned_url: str  # Valid for `presigned_url_expiry` seconds

    model_config = {"from_attributes": True}


class ImageMetadata(BaseModel):
    id: int
    original_filename: str
    s3_key: str
    content_type: str
    file_size: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ImageDetailResponse(ImageMetadata):
    presigned_url: str


class DeleteResponse(BaseModel):
    message: str
    id: int

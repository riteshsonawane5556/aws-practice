from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.image import Image
from app.schemas.image import (
    DeleteResponse,
    ImageDetailResponse,
    ImageMetadata,
    ImageUploadResponse,
)
from app.services.s3 import s3_service

router = APIRouter(prefix="/images", tags=["Images"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/upload",
    response_model=ImageUploadResponse,
    status_code=201,
    summary="Upload an image to S3",
    description=(
        "Accepts a multipart file upload. The image is stored in S3 under the "
        "`images/` prefix and its metadata (filename, S3 key, content type, size) "
        "is saved to SQLite. Returns the metadata plus a presigned URL valid for "
        "`PRESIGNED_URL_EXPIRY` seconds."
    ),
)
async def upload_image(
    file: UploadFile = File(..., description="Image file (JPEG, PNG, GIF, or WebP)"),
    db: Session = Depends(get_db),
):
    """
    Upload flow:
      1. Validate MIME type
      2. Read bytes into memory and validate size
      3. Generate a unique S3 key
      4. PUT object to S3 with correct ContentType
      5. Insert metadata record into SQLite
      6. Return metadata + fresh presigned URL
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"File type '{file.content_type}' is not allowed. "
                f"Accepted types: {sorted(ALLOWED_CONTENT_TYPES)}"
            ),
        )

    file_data = await file.read()

    if len(file_data) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB limit.",
        )

    s3_key = s3_service.generate_s3_key(file.filename)
    s3_service.upload_file(file_data, s3_key, file.content_type)

    image = Image(
        original_filename=file.filename,
        s3_key=s3_key,
        content_type=file.content_type,
        file_size=len(file_data),
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    presigned_url = s3_service.generate_presigned_url(s3_key)

    return ImageUploadResponse(
        id=image.id,
        original_filename=image.original_filename,
        s3_key=image.s3_key,
        content_type=image.content_type,
        file_size=image.file_size,
        created_at=image.created_at,
        presigned_url=presigned_url,
    )


@router.get(
    "/",
    response_model=list[ImageMetadata],
    summary="List all uploaded images",
    description=(
        "Returns metadata for all images. Presigned URLs are intentionally omitted "
        "here — generating one per image on a large list would be slow. Fetch "
        "individual images (GET /images/{id}) to get a presigned URL."
    ),
)
def list_images(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    images = db.query(Image).order_by(Image.created_at.desc()).offset(skip).limit(limit).all()
    return images


@router.get(
    "/s3-objects",
    summary="List raw S3 objects",
    description=(
        "Lists objects directly from S3 under the `images/` prefix using the "
        "list_objects_v2 paginator. Useful for learning — compare this raw S3 "
        "view against the SQLite metadata in GET /images/."
    ),
)
def list_s3_objects():
    return s3_service.list_objects(prefix="images/")


@router.get(
    "/{image_id}",
    response_model=ImageDetailResponse,
    summary="Get image metadata and a presigned URL",
    description=(
        "Fetches a single image's metadata from SQLite and generates a fresh "
        "presigned URL. The URL is generated on every request because it has a TTL."
    ),
)
def get_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail=f"Image {image_id} not found.")

    presigned_url = s3_service.generate_presigned_url(image.s3_key)

    return ImageDetailResponse(
        id=image.id,
        original_filename=image.original_filename,
        s3_key=image.s3_key,
        content_type=image.content_type,
        file_size=image.file_size,
        created_at=image.created_at,
        presigned_url=presigned_url,
    )


@router.delete(
    "/{image_id}",
    response_model=DeleteResponse,
    summary="Delete an image from S3 and the database",
    description=(
        "Deletes the S3 object first, then removes the database record. "
        "Order matters: if S3 deletion fails the DB record is preserved "
        "(S3 is the source of truth for the actual file)."
    ),
)
def delete_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail=f"Image {image_id} not found.")

    # Delete from S3 first — if this fails, we keep the DB record.
    s3_service.delete_file(image.s3_key)

    # S3 object is gone; now remove the metadata record.
    db.delete(image)
    db.commit()

    return DeleteResponse(message="Image deleted successfully.", id=image_id)

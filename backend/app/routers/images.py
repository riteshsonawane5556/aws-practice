from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.image import Image
from app.schemas.image import (
    ConfirmUploadRequest,
    DeleteResponse,
    GenerateUploadUrlRequest,
    GenerateUploadUrlResponse,
    ImageDetailResponse,
    ImageMetadata,
    ImageUploadResponse,
)
from app.services.s3 import s3_service

router = APIRouter(prefix="/images", tags=["Images"])


# ── Step 1 ─────────────────────────────────────────────────────────────────────

@router.post(
    "/generate-upload-url",
    response_model=GenerateUploadUrlResponse,
    summary="Request a presigned URL to upload an image directly to S3",
    description="""
**Frontend-upload flow — Step 1 of 2.**

The backend never receives the file. Instead:

1. Frontend calls this endpoint with the file's `filename`, `content_type`, and `file_size`.
2. Backend validates the metadata, generates a unique S3 key, and returns a presigned PUT URL.
3. Frontend PUTs the file directly to S3 using `upload_url`:
```js
await fetch(upload_url, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': content_type }
});
```
4. After S3 returns 200, call **POST /images/confirm-upload** with the `s3_key` and metadata.

The `upload_url` expires in 5 minutes.
""",
)
def generate_upload_url(body: GenerateUploadUrlRequest):
    """
    Validation happens in the Pydantic schema (content_type whitelist, size limit).
    This handler just generates the S3 key and the presigned URL.
    """
    s3_key = s3_service.generate_s3_key(body.filename)
    upload_url = s3_service.generate_presigned_put_url(s3_key, body.content_type)

    return GenerateUploadUrlResponse(
        s3_key=s3_key,
        upload_url=upload_url,
        expires_in=s3_service.UPLOAD_URL_EXPIRY,
    )


# ── Step 2 ─────────────────────────────────────────────────────────────────────

@router.post(
    "/confirm-upload",
    response_model=ImageUploadResponse,
    status_code=201,
    summary="Confirm a completed S3 upload and save metadata to the database",
    description="""
**Frontend-upload flow — Step 2 of 2.**

Call this *after* the frontend has successfully PUT the file to S3.

The backend:
1. Calls S3 `head_object` to verify the object actually exists in the bucket.
2. Creates a metadata record in SQLite.
3. Returns the metadata plus a presigned GET URL for immediate display.

If the object is not found in S3 (frontend upload failed or wrong key), returns 404.
""",
)
def confirm_upload(body: ConfirmUploadRequest, db: Session = Depends(get_db)):
    """
    Why verify with head_object?
      The frontend claims it uploaded the file. We verify independently so
      the database never holds a record that points to a missing S3 object.
      head_object is a lightweight metadata-only request — it does not
      download the file.
    """
    # Verify the object is actually in S3 before trusting the frontend's claim
    from botocore.exceptions import ClientError
    try:
        s3_service.client.head_object(
            Bucket=s3_service.bucket_name,
            Key=body.s3_key,
        )
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code in ("404", "NoSuchKey"):
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Object '{body.s3_key}' not found in S3. "
                    "Make sure the file was uploaded successfully before calling this endpoint."
                ),
            )
        raise HTTPException(status_code=500, detail=f"S3 verification failed: {exc}")

    # Object confirmed — save metadata
    image = Image(
        original_filename=body.original_filename,
        s3_key=body.s3_key,
        content_type=body.content_type,
        file_size=body.file_size,
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    presigned_url = s3_service.generate_presigned_url(image.s3_key)

    return ImageUploadResponse(
        id=image.id,
        original_filename=image.original_filename,
        s3_key=image.s3_key,
        content_type=image.content_type,
        file_size=image.file_size,
        created_at=image.created_at,
        presigned_url=presigned_url,
    )


# ── Read ───────────────────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=list[ImageMetadata],
    summary="List all uploaded images",
    description=(
        "Returns metadata for all images. Presigned URLs are omitted — "
        "generating one per image on a large list would be slow. "
        "Call GET /images/{id} to get a presigned URL for a specific image."
    ),
)
def list_images(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return db.query(Image).order_by(Image.created_at.desc()).offset(skip).limit(limit).all()


@router.get(
    "/s3-objects",
    summary="List raw S3 objects (learning endpoint)",
    description=(
        "Lists objects directly from S3 under the `images/` prefix using "
        "the `list_objects_v2` paginator. Compare this against GET /images/ "
        "to see the difference between raw S3 storage and the DB metadata layer."
    ),
)
def list_s3_objects():
    return s3_service.list_objects(prefix="images/")


@router.get(
    "/{image_id}",
    response_model=ImageDetailResponse,
    summary="Get image metadata and a fresh presigned GET URL",
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


# ── Delete ─────────────────────────────────────────────────────────────────────

@router.delete(
    "/{image_id}",
    response_model=DeleteResponse,
    summary="Delete an image from S3 and the database",
    description=(
        "Deletes the S3 object first, then removes the DB record. "
        "If S3 deletion fails, the DB record is preserved."
    ),
)
def delete_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail=f"Image {image_id} not found.")

    s3_service.delete_file(image.s3_key)

    db.delete(image)
    db.commit()

    return DeleteResponse(message="Image deleted successfully.", id=image_id)

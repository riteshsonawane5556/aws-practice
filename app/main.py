from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routers import images


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once at startup (before first request) and once at shutdown.

    Startup: verify that the configured S3 bucket is reachable.
    This makes credential and bucket-name errors surface immediately —
    before any real requests come in — rather than on the first upload.
    """
    from app.services.s3 import s3_service

    try:
        s3_service.client.head_bucket(Bucket=s3_service.bucket_name)
        print(f"[startup] S3 bucket '{s3_service.bucket_name}' is accessible.")
    except Exception as exc:
        # Print a warning but don't crash — lets the app start even if S3
        # is temporarily unreachable (useful during local development).
        print(f"[startup] WARNING: S3 connectivity check failed: {exc}")

    yield  # --- application runs here ---

    print("[shutdown] Application shutting down.")


app = FastAPI(
    title="AWS S3 Image Service",
    description=(
        "A learning project demonstrating AWS S3 image upload and retrieval "
        "with FastAPI + SQLAlchemy + Alembic.\n\n"
        "**Key concepts covered:**\n"
        "- boto3 S3 client setup with IAM credentials\n"
        "- Object keys and virtual prefixes\n"
        "- Uploading bytes with `put_object` and ContentType metadata\n"
        "- Presigned URLs for time-limited private access\n"
        "- Paginated object listing with `list_objects_v2`\n"
        "- Structured error handling with `ClientError`"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(images.router)


@app.get("/health", tags=["Health"])
def health_check():
    """Simple liveness probe — returns 200 if the app is running."""
    return {"status": "ok"}

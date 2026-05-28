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
    ),
    lifespan=lifespan,
)

app.include_router(images.router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # AWS credentials — get from IAM > Users > Security Credentials
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str = "us-east-1"

    # The S3 bucket must already exist before running the app
    s3_bucket_name: str

    # How long presigned URLs remain valid (seconds). Default: 1 hour.
    # After this time, the URL returns 403 — the client must request a fresh one.
    presigned_url_expiry: int = 3600

    # SQLite file path. The file is created automatically by Alembic migrations.
    database_url: str = "sqlite:///./images.db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


# Single shared instance — imported by every module that needs config.
# pydantic-settings raises ValidationError at startup if any required field is missing.
settings = Settings()

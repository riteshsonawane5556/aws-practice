"""
S3 Service — core of the AWS learning module.

Demonstrates the key S3 concepts you will encounter in real projects:

  1. boto3 client setup with explicit credentials
  2. Object keys and prefixes (virtual folders in S3)
  3. Uploading bytes with ContentType metadata via put_object
  4. Presigned URLs — time-limited signed access to private objects
  5. Existence check with head_object before delete
  6. Paginated listing with list_objects_v2 paginator
  7. Structured error handling with ClientError / NoCredentialsError
"""
import uuid

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from fastapi import HTTPException

from app.config import settings


class S3Service:
    """
    Wraps all S3 operations used by the image API.

    A single instance (`s3_service`) is created at module load time and
    shared across all requests — boto3 clients are thread-safe.
    """

    def __init__(self) -> None:
        # Low-level S3 client with explicit credentials from config.
        # In production on EC2/Lambda, you would omit the key/secret and rely
        # on IAM roles attached to the instance — boto3 picks them up automatically.
        self.client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        self.bucket_name = settings.s3_bucket_name
        self.presigned_expiry = settings.presigned_url_expiry

    # ------------------------------------------------------------------
    # Key generation
    # ------------------------------------------------------------------

    def generate_s3_key(self, original_filename: str) -> str:
        """
        Build a unique S3 object key for a new upload.

        Format: images/<uuid4>_<sanitized_filename>

        Why "images/" prefix?
          S3 has no real folders — it stores flat key-value pairs.
          But keys that share a prefix appear as a "folder" in the AWS
          Console and can be listed/deleted as a group. Using a prefix
          keeps uploads organised and separable from other object types
          you might store in the same bucket later.

        Why UUID?
          Two users can upload "profile.jpg". Without a UUID the second
          upload would silently overwrite the first. The UUID guarantees
          every key is unique regardless of the original filename.
        """
        unique_id = uuid.uuid4()
        safe_name = original_filename.replace(" ", "_")
        return f"images/{unique_id}_{safe_name}"

    # ------------------------------------------------------------------
    # Upload
    # ------------------------------------------------------------------

    def upload_file(self, file_data: bytes, s3_key: str, content_type: str) -> str:
        """
        Upload raw bytes to S3 using put_object.

        Why put_object instead of upload_file (the higher-level helper)?
          put_object maps 1-to-1 to the S3 PutObject API call and lets
          us set ContentType in the same request. It also works directly
          with in-memory bytes — no temp file needed.

        ContentType is stored as S3 object metadata. When you later
        access the object via a presigned URL, S3 sends this value as
        the HTTP Content-Type header, which tells the browser how to
        render the response (inline image vs. download prompt).
        """
        try:
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_data,
                ContentType=content_type,
                # Browser caching hint — S3 stores this and includes it in responses.
                CacheControl="max-age=86400",
            )
            return s3_key
        except NoCredentialsError:
            raise HTTPException(
                status_code=500,
                detail="AWS credentials are not configured correctly.",
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            msg = exc.response["Error"]["Message"]
            raise HTTPException(
                status_code=500,
                detail=f"S3 upload failed [{code}]: {msg}",
            )

    # ------------------------------------------------------------------
    # Presigned URL
    # ------------------------------------------------------------------

    def generate_presigned_url(self, s3_key: str) -> str:
        """
        Generate a presigned URL that grants temporary read access to s3_key.

        How presigned URLs work:
          A presigned URL embeds the bucket name, object key, your AWS
          credentials, an expiry timestamp, and a cryptographic signature
          (HMAC-SHA256). S3 validates the signature on every request and
          rejects the URL once the expiry passes.

          This means:
          - The bucket can stay fully PRIVATE (no public access needed).
          - Anyone who receives the URL can download the object until it
            expires — no AWS account required.
          - After expiry, the URL returns HTTP 403 Forbidden.

        This is the standard pattern for serving user-uploaded files from
        S3 without exposing your bucket publicly or proxying traffic through
        your own servers.

        We generate a fresh URL on every GET request rather than storing
        one, because stored URLs would expire and become useless.
        """
        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": s3_key},
                ExpiresIn=self.presigned_expiry,
            )
            return url
        except ClientError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate presigned URL: {exc}",
            )

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    def delete_file(self, s3_key: str) -> None:
        """
        Delete an object from S3.

        Why head_object first?
          S3's delete_object is idempotent — it silently succeeds even
          when the key does not exist. That's great for retry logic but
          bad for user-facing error messages. We call head_object (which
          DOES raise a 404 for missing keys) to give a clear error before
          the delete.
        """
        # Verify the object exists
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=s3_key)
        except ClientError as exc:
            error_code = exc.response["Error"]["Code"]
            if error_code in ("404", "NoSuchKey"):
                raise HTTPException(
                    status_code=404,
                    detail=f"Object not found in S3: {s3_key}",
                )
            raise HTTPException(status_code=500, detail=str(exc))

        # Perform the delete
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=s3_key)
        except ClientError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"S3 delete failed: {exc}",
            )

    # ------------------------------------------------------------------
    # List
    # ------------------------------------------------------------------

    def list_objects(self, prefix: str = "images/") -> list[dict]:
        """
        List all objects under a key prefix.

        Why a paginator?
          list_objects_v2 returns at most 1000 objects per API call.
          If there are more, the response includes a continuation token.
          boto3 paginators handle this automatically — they loop and
          merge pages so you always get the full result set.

          Always use paginators for list operations in production code.
        """
        paginator = self.client.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)

        objects = []
        for page in pages:
            for obj in page.get("Contents", []):
                objects.append(
                    {
                        "key": obj["Key"],
                        "size_bytes": obj["Size"],
                        "last_modified": obj["LastModified"].isoformat(),
                    }
                )
        return objects


# Module-level singleton — one boto3 client shared across all requests.
s3_service = S3Service()

from datetime import datetime
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Image(Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # The filename the user originally uploaded (e.g. "beach_photo.jpg")
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    # The full S3 object key: "images/<uuid>_<filename>"
    # This is the identifier boto3 uses to locate the object in the bucket.
    # It is unique so two users uploading the same filename don't collide.
    s3_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)

    # MIME type (e.g. "image/jpeg"). Stored so we can pass it to S3 when
    # generating presigned URLs and so browsers render the image correctly.
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)

    # File size in bytes — useful for display and enforcing storage limits.
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)

    # Record creation timestamp (UTC).
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Image id={self.id} filename={self.original_filename} key={self.s3_key}>"

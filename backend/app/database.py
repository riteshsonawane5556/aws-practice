from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

# connect_args={"check_same_thread": False} is SQLite-specific.
# FastAPI handles requests across threads; without this flag SQLite raises:
# "Objects created in a thread can only be used in that same thread."
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """
    FastAPI dependency. Use with Depends(get_db) in route functions.

    Yields a database session for the duration of the request, then
    closes it — even if the route raised an exception.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

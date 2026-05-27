import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Make the project root importable so `from app.xxx import yyy` works.
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.config import settings       # reads .env
from app.database import Base         # DeclarativeBase with our metadata
from app.models import image          # noqa: F401 — registers Image with Base.metadata

# Alembic Config object — gives access to alembic.ini values.
config = context.config

# Set up Python logging from alembic.ini (optional but useful).
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override the sqlalchemy.url from alembic.ini with the value from .env.
# This is the key line — it means you never hard-code the DB URL in alembic.ini.
config.set_main_option("sqlalchemy.url", settings.database_url)

# target_metadata tells Alembic what your schema *should* look like.
# With this set, `alembic revision --autogenerate` compares Base.metadata
# against the actual database and generates the diff as migration code.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Offline mode: emit SQL to stdout instead of running it.
    Useful for generating SQL scripts to review before applying.
    Run with: alembic upgrade head --sql
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Online mode: connect to the database and apply migrations directly.
    This is the normal path used by `alembic upgrade head`.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

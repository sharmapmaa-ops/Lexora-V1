"""
Database engine + session factory.

One engine for the whole process (SQLAlchemy pools connections internally,
so there's no need to create a new engine per-request). Routes get a
session through the ``get_db`` dependency in api/v1/deps.py, never by
importing anything from here directly - that keeps request-scoped session
lifecycle (open -> use -> close/rollback) in exactly one place.
"""
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(
    str(settings.DATABASE_URL),
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,  # drops stale connections instead of surfacing them as query errors
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Every ORM model inherits from this. Having one shared Base (instead
    of each model file declaring its own) is what lets Alembic's
    autogenerate see the full schema in one place."""
    pass


@contextmanager
def session_scope():
    """For use OUTSIDE of request handlers (scripts, background jobs,
    startup seeding) where there's no FastAPI dependency injection to
    lean on."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

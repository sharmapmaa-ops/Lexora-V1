"""
Object storage abstraction.

Every processing pipeline reads/writes files through this module, never
through raw `open()` calls scattered across services - that's what
makes `STORAGE_BACKEND=s3` a config change instead of a rewrite when
it's time to move off local disk (see app/core/config.py).

Only a local-disk backend is implemented for now. The interface below
is what an S3Storage class would implement identically - adding it
later doesn't touch any calling code.
"""
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import settings


class Storage(ABC):
    @abstractmethod
    def save(self, key: str, data: bytes) -> str:
        """Write `data` under `key`, return the key (may be normalized)."""

    @abstractmethod
    def read(self, key: str) -> bytes:
        ...

    @abstractmethod
    def exists(self, key: str) -> bool:
        ...


class LocalStorage(Storage):
    def __init__(self, root: str):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # Reject any key that could escape the storage root.
        path = (self.root / key).resolve()
        if not str(path).startswith(str(self.root.resolve())):
            raise ValueError(f"Invalid storage key: {key!r}")
        return path

    def save(self, key: str, data: bytes) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).exists()


def get_storage() -> Storage:
    if settings.STORAGE_BACKEND == "local":
        return LocalStorage(settings.STORAGE_LOCAL_DIR)
    raise NotImplementedError(
        f"Storage backend '{settings.STORAGE_BACKEND}' is not implemented yet. "
        "Add an S3Storage(Storage) class here and return it when STORAGE_BACKEND=s3."
    )


def new_storage_key(user_id, service_code: str, filename: str) -> str:
    ext = Path(filename).suffix
    return f"{service_code}/{user_id}/{uuid.uuid4()}{ext}"

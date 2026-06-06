from pathlib import Path

from app.core.config import settings


def uploads_root() -> Path:
    root = settings.resolved_uploads_root
    root.mkdir(parents=True, exist_ok=True)
    return root


def uploads_subdir(name: str) -> Path:
    path = uploads_root() / name
    path.mkdir(parents=True, exist_ok=True)
    return path

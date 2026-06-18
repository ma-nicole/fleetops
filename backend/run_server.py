"""Production entrypoint — Railway-safe PORT handling and migrations."""
from __future__ import annotations

import os
import subprocess
import sys


def listen_port() -> int:
    raw = (os.environ.get("PORT") or "8000").strip()
    if raw in ("", "$PORT"):
        return 8000
    return int(raw)


def main() -> None:
    print("Running database migrations...")
    rc = subprocess.call([sys.executable, "-m", "alembic", "upgrade", "head"])
    if rc != 0:
        print("WARNING: alembic upgrade failed — check DATABASE_URL. Starting API anyway.")
    else:
        print("Migrations complete.")

    port = listen_port()
    print(f"Starting uvicorn on port {port}...")
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()

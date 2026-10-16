"""Disposable local-only API used by browser acceptance tests; never uses .env."""

import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory


def main():
    root = Path(__file__).resolve().parents[1]
    with TemporaryDirectory(prefix="cmmi-browser-") as directory:
        env = {
            **os.environ,
            "ENVIRONMENT": "development",
            "DATABASE_URL": f"sqlite+aiosqlite:///{Path(directory) / 'e2e.db'}",
            "DATABASE_DIRECT_URL": "",
            "SECRET_KEY": "disposable-browser-test-secret-32-characters",
            "CMMI_BOOTSTRAP_PASSWORD": "BrowserFixturePassword123!",
            "SCHEDULER_ENABLED": "false",
        }
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=root, env=env, check=True)
        subprocess.run(
            [sys.executable, "-m", "app.bootstrap", "--email", "browser@example.com"],
            cwd=root,
            env=env,
            check=True,
        )
        subprocess.run(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8011"],
            cwd=root,
            env=env,
            check=True,
        )


if __name__ == "__main__":
    main()

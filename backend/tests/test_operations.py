import os
from pathlib import Path
import sqlite3
import subprocess
import sys


def test_migration_bootstrap_and_schema_roundtrip(tmp_path):
    database = tmp_path / "migration.db"
    env = {
        **os.environ,
        "DATABASE_URL": f"sqlite+aiosqlite:///{database}",
        "DATABASE_DIRECT_URL": "",
        "ENVIRONMENT": "development",
        "CMMI_BOOTSTRAP_PASSWORD": "FixturePassword123!",
    }
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    with sqlite3.connect(database) as db:
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert {
            "users",
            "api_keys",
            "contents",
            "media_assets",
            "content_media_links",
            "system_settings",
        } <= tables
        assert db.execute(
            "SELECT auto_clean_media, retention_days, cron_expression FROM system_settings"
        ).fetchone() == (1, 7, "0 2 * * *")
    command = [sys.executable, "-m", "app.bootstrap", "--email", "admin@example.com"]
    first = subprocess.run(command, cwd=root, env=env, capture_output=True, text=True)
    assert first.returncode == 0, first.stderr
    second = subprocess.run(command, cwd=root, env=env, capture_output=True, text=True)
    assert second.returncode != 0
    with sqlite3.connect(database) as db:
        email, role, hashed = db.execute("SELECT email, role, password_hash FROM users").fetchone()
        assert email == "admin@example.com" and role == "ADMIN" and hashed.startswith("$argon2")
    check = subprocess.run(
        [sys.executable, "-m", "alembic", "check"], cwd=root, env=env, capture_output=True, text=True
    )
    assert check.returncode == 0, check.stdout + check.stderr
    down = subprocess.run(
        [sys.executable, "-m", "alembic", "downgrade", "base"],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
    )
    assert down.returncode == 0, down.stderr


async def test_scheduler_lifecycle_and_rescheduling(env):
    app, client, h, _ = env
    app.state.settings.scheduler_enabled = True
    async with app.router.lifespan_context(app):
        scheduler = getattr(app.state, "scheduler", None)
        assert scheduler is not None and scheduler.running
        job = scheduler.get_job("media-cleanup")
        assert job is not None and job.max_instances == 1
        response = await client.put(
            "/api/v1/settings/cleanup",
            headers=h[0],
            json={"cron_expression": "15 4 * * *", "retention_days": 7, "auto_clean_media": True},
        )
        assert response.status_code == 200
        assert str(scheduler.get_job("media-cleanup").trigger.fields[-2]) == "15"


def test_postgresql_rollback_removes_migration_owned_enum_types():
    root = Path(__file__).resolve().parents[1]
    env = {
        **os.environ,
        "DATABASE_URL": "postgresql+asyncpg://test:test@localhost/cmmi_test",
        "DATABASE_DIRECT_URL": "",
        "ENVIRONMENT": "development",
    }
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "downgrade", "0001:base", "--sql"],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    for type_name in ["user_role", "media_type", "content_status"]:
        assert f"DROP TYPE {type_name}" in result.stdout

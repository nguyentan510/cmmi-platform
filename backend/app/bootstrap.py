import argparse
import asyncio
import getpass
import os

from sqlalchemy import select

from app.core.config import Settings
from app.core.security import hash_password
from app.db.session import make_engine, session_factory
from app.models import User
from app.schemas import Role, UserCreate


async def bootstrap(email: str, password: str, if_needed: bool = False):
    payload = UserCreate(email=email, password=password, role=Role.ADMIN)
    settings = Settings()
    engine = make_engine(settings.database_direct_url or settings.database_url)
    try:
        async with session_factory(engine)() as db:
            if await db.scalar(
                select(User.id).where(User.role == Role.ADMIN, User.is_active.is_(True)).limit(1)
            ):
                if if_needed:
                    print("An active administrator already exists. Skipping bootstrap.")
                    return
                raise SystemExit(
                    "An active administrator already exists. Use the admin UI to create accounts."
                )
            if await db.scalar(select(User.id).where(User.email == str(payload.email).lower())):
                if if_needed:
                    print("Email already exists. Skipping bootstrap.")
                    return
                raise SystemExit("Email already exists; bootstrap will not overwrite an account.")
            db.add(
                User(
                    email=str(payload.email).lower(),
                    password_hash=hash_password(payload.password),
                    role=Role.ADMIN,
                )
            )
            await db.commit()
            print("Initial administrator created.")
    finally:
        await engine.dispose()


def main():
    parser = argparse.ArgumentParser(
        description="Create the first admin after explicitly applying migrations"
    )
    parser.add_argument("--email", required=True)
    parser.add_argument(
        "--if-needed",
        action="store_true",
        help="Skip without error if an active administrator or this email already exists",
    )
    args = parser.parse_args()
    password = os.environ.get("CMMI_BOOTSTRAP_PASSWORD") or getpass.getpass(
        "Initial admin password (12+ characters): "
    )
    asyncio.run(bootstrap(args.email, password, if_needed=args.if_needed))


if __name__ == "__main__":
    main()

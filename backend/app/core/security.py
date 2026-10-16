import hashlib
import secrets
from datetime import timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.models import utcnow

passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash("dummy-password-for-timing-equalization")


def hash_password(password: str) -> str:
    return passwords.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return passwords.verify(password, hashed)
    except (ValueError, UnknownHashError):
        return False


def access_token(user, settings) -> str:
    now = utcnow()
    return jwt.encode(
        {
            "sub": str(user.id),
            "iat": now,
            "exp": now + timedelta(minutes=settings.token_expire_minutes),
            "type": "access",
        },
        settings.secret_key,
        algorithm="HS256",
    )


def key_hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def new_key() -> str:
    return "cmmi_live_" + secrets.token_urlsafe(32)

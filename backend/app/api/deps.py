from dataclasses import dataclass
from datetime import timezone
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import key_hash
from app.models import ApiKey, User, utcnow
from app.schemas import Role, SCOPES

bearer = HTTPBearer(auto_error=False)
api_key = APIKeyHeader(name="X-API-Key", auto_error=False)


async def database(request: Request):
    async with request.app.state.sessions() as db:
        yield db


DB = Annotated[AsyncSession, Depends(database)]


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


@dataclass
class Principal:
    user: User
    scopes: set[str]
    is_api_key: bool = False


async def current_principal(
    request: Request,
    db: DB,
    token: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    secret: Annotated[str | None, Depends(api_key)],
) -> Principal:
    user = None
    scopes = set(SCOPES)
    record = None
    if secret:
        record = await db.scalar(
            select(ApiKey).where(ApiKey.key_hash == key_hash(secret), ApiKey.is_active.is_(True))
        )
        if record and (record.expires_at is None or aware(record.expires_at) > utcnow()):
            user = await db.get(User, record.user_id)
            scopes = set(record.scopes)
        else:
            raise HTTPException(401, "Invalid or expired API key")
    elif token:
        try:
            claims = jwt.decode(
                token.credentials,
                request.app.state.settings.secret_key,
                algorithms=["HS256"],
                options={"require": ["sub", "exp", "iat", "type"]},
            )
            if claims["type"] != "access":
                raise ValueError("Wrong token type")
            user = await db.get(User, UUID(claims["sub"]))
        except (jwt.PyJWTError, ValueError, TypeError):
            raise HTTPException(401, "Invalid or expired token")
    if user is None or not user.is_active:
        raise HTTPException(401, "Authentication required", headers={"WWW-Authenticate": "Bearer"})
    if user.role != Role.ADMIN:
        scopes -= {"users:read", "users:write", "settings:read", "settings:write"}
    if record:
        record.last_used_at = utcnow()
        await db.commit()
    return Principal(user, scopes, record is not None)


PrincipalDep = Annotated[Principal, Depends(current_principal)]


def require(scope: str, admin=False):
    async def check(principal: PrincipalDep):
        if scope not in principal.scopes or (admin and principal.user.role != Role.ADMIN):
            raise HTTPException(403, "Insufficient permissions")
        return principal

    return check


def own(record, principal, field="author_id"):
    if record is None or (principal.user.role != Role.ADMIN and getattr(record, field) != principal.user.id):
        raise HTTPException(404, "Resource not found")
    return record

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DB, PrincipalDep, own, require
from app.api.router import Router
from app.core.security import DUMMY_HASH, access_token, hash_password, key_hash, new_key, verify_password
from app.models import ApiKey, User
from app.schemas import KeyCreate, KeyCreated, KeyRead, Login, Role, Token, UserCreate, UserRead, UserUpdate

router = Router(tags=["Authentication and administration"])


@router.post("/auth/login", response_model=Token, summary="Sign in with email and password")
async def login(payload: Login, db: DB, request: Request):
    """Exchange an active account's credentials for an expiring Bearer JWT."""
    user = await db.scalar(select(User).where(User.email == str(payload.email).lower()))
    valid = verify_password(payload.password, user.password_hash if user else DUMMY_HASH)
    if not valid or user is None or not user.is_active:
        raise HTTPException(401, "Invalid credentials")
    return Token(access_token=access_token(user, request.app.state.settings))


@router.get("/auth/me", response_model=UserRead, summary="Read the authenticated profile")
async def me(principal: PrincipalDep):
    """Resolve the current account using either Bearer JWT or X-API-Key."""
    return principal.user


@router.get("/users", response_model=list[UserRead], summary="List system users (admin)")
async def users(
    db: DB,
    principal=Depends(require("users:read", admin=True)),
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
):
    """List accounts, including inactive users. Restricted to admins."""
    return (
        await db.scalars(select(User).order_by(User.created_at).offset(max(offset, 0)).limit(limit))
    ).all()


@router.post("/users", response_model=UserRead, status_code=201, summary="Create a user (admin)")
async def create_user(payload: UserCreate, db: DB, principal=Depends(require("users:write", admin=True))):
    """Create an account with an Argon2 password hash and a bounded role."""
    user = User(
        email=str(payload.email).lower(), password_hash=hash_password(payload.password), role=payload.role
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Email already exists")
    return user


@router.patch("/users/{user_id}", response_model=UserRead, summary="Update user access (admin)")
async def update_user(
    user_id: UUID, payload: UserUpdate, db: DB, principal=Depends(require("users:write", admin=True))
):
    """Change role, active status or password. Self-deactivation/demotion is blocked."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    data = payload.model_dump(exclude_unset=True)
    if user.id == principal.user.id and (
        data.get("is_active") is False or data.get("role", Role.ADMIN) != Role.ADMIN
    ):
        raise HTTPException(409, "Cannot disable or demote your own admin account")
    if "password" in data:
        user.password_hash = hash_password(data.pop("password"))
    for name, value in data.items():
        setattr(user, name, value)
    await db.commit()
    return user


@router.get("/api-keys", response_model=list[KeyRead], summary="List API key metadata")
async def list_keys(db: DB, principal=Depends(require("keys:read"))):
    """Creators see their own keys; admins see all keys. Secrets and hashes are never returned."""
    query = select(ApiKey)
    if principal.user.role != Role.ADMIN:
        query = query.where(ApiKey.user_id == principal.user.id)
    return (await db.scalars(query.order_by(ApiKey.name))).all()


@router.post("/api-keys", response_model=KeyCreated, status_code=201, summary="Create a scoped API key")
async def create_key(payload: KeyCreate, db: DB, principal=Depends(require("keys:write"))):
    """Return a new 32-byte random secret once. Persist only SHA-256 and display prefix."""
    if not set(payload.scopes) <= principal.scopes:
        raise HTTPException(403, "Requested scopes exceed caller permissions")
    secret = new_key()
    record = ApiKey(
        user_id=principal.user.id,
        name=payload.name,
        scopes=payload.scopes,
        expires_at=payload.expires_at,
        key_prefix=secret[:17],
        key_hash=key_hash(secret),
    )
    db.add(record)
    await db.commit()
    return KeyCreated(**KeyRead.model_validate(record).model_dump(), key=secret)


@router.delete("/api-keys/{key_id}", status_code=204, summary="Revoke an API key")
async def revoke_key(key_id: UUID, db: DB, principal=Depends(require("keys:write"))):
    """Revoke your own key, or any key as an admin. Revocation takes effect immediately."""
    record = own(await db.get(ApiKey, key_id), principal, "user_id")
    record.is_active = False
    await db.commit()
    return Response(status_code=204)

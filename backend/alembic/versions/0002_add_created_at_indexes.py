"""add_created_at_indexes

Revision ID: 0002
Revises: 0001
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(op.f("ix_contents_created_at"), "contents", ["created_at"], unique=False)
    op.create_index(op.f("ix_media_assets_created_at"), "media_assets", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_media_assets_created_at"), table_name="media_assets")
    op.drop_index(op.f("ix_contents_created_at"), table_name="contents")

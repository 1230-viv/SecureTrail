"""add_category_learned_table

Revision ID: 383338cb9477
Revises: add_behavioral_tables
Create Date: 2026-03-07 15:55:16.369650

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '383338cb9477'
down_revision: Union[str, None] = 'add_behavioral_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

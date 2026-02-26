"""add s3_url to scan_jobs

Revision ID: add_s3_url_column
Revises: ff9eb33c8aea
Create Date: 2026-02-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_s3_url_column'
down_revision: Union[str, None] = 'ff9eb33c8aea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add s3_url column to scan_jobs table
    op.add_column('scan_jobs', sa.Column('s3_url', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove s3_url column from scan_jobs table
    op.drop_column('scan_jobs', 's3_url')

"""Toll plaza alias tables."""
from alembic import op
import sqlalchemy as sa

revision = "20260607_0003_toll_plaza_aliases"
down_revision = "20260607_0002_toll_matrix"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "toll_plazas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("canonical_name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_toll_plazas_canonical_name", "toll_plazas", ["canonical_name"], unique=True)
    op.create_index("ix_toll_plazas_status", "toll_plazas", ["status"])

    op.create_table(
        "toll_plaza_aliases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plaza_id", sa.Integer(), sa.ForeignKey("toll_plazas.id"), nullable=False),
        sa.Column("alias", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_toll_plaza_aliases_plaza_id", "toll_plaza_aliases", ["plaza_id"])
    op.create_index("ix_toll_plaza_aliases_alias", "toll_plaza_aliases", ["alias"])


def downgrade() -> None:
    op.drop_table("toll_plaza_aliases")
    op.drop_table("toll_plazas")

"""Toll matrix tables and booking/trip toll budget columns."""
from alembic import op
import sqlalchemy as sa

revision = "20260607_0002_toll_matrix"
down_revision = "20260606_0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "toll_matrix",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entry_point", sa.String(255), nullable=False),
        sa.Column("exit_point", sa.String(255), nullable=False),
        sa.Column("vehicle_class", sa.String(32), nullable=False, server_default="Class 3"),
        sa.Column("toll_fee", sa.Float(), nullable=False, server_default="0"),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_toll_matrix_entry_point", "toll_matrix", ["entry_point"])
    op.create_index("ix_toll_matrix_exit_point", "toll_matrix", ["exit_point"])
    op.create_index("ix_toll_matrix_vehicle_class", "toll_matrix", ["vehicle_class"])
    op.create_index("ix_toll_matrix_effective_date", "toll_matrix", ["effective_date"])
    op.create_index("ix_toll_matrix_status", "toll_matrix", ["status"])

    op.create_table(
        "additional_toll_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id"), nullable=False),
        sa.Column("driver_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("receipt_url", sa.String(500), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_additional_toll_entries_trip_id", "additional_toll_entries", ["trip_id"])
    op.create_index("ix_additional_toll_entries_driver_id", "additional_toll_entries", ["driver_id"])

    op.create_table(
        "historical_toll_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id"), nullable=False),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("route_label", sa.String(512), nullable=False, server_default=""),
        sa.Column("entry_point", sa.String(255), nullable=False, server_default=""),
        sa.Column("exit_point", sa.String(255), nullable=False, server_default=""),
        sa.Column("origin", sa.String(255), nullable=False, server_default=""),
        sa.Column("destination", sa.String(255), nullable=False, server_default=""),
        sa.Column("vehicle_class", sa.String(32), nullable=False, server_default="Class 3"),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("estimated_toll", sa.Float(), nullable=False, server_default="0"),
        sa.Column("actual_toll", sa.Float(), nullable=False, server_default="0"),
        sa.Column("toll_variance", sa.Float(), nullable=False, server_default="0"),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_historical_toll_records_trip_id", "historical_toll_records", ["trip_id"])
    op.create_index("ix_historical_toll_records_booking_id", "historical_toll_records", ["booking_id"])

    with op.batch_alter_table("bookings") as batch:
        batch.add_column(sa.Column("estimated_toll_budget_php", sa.Float(), nullable=True))
        batch.add_column(sa.Column("toll_matrix_matched", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("toll_estimate_message", sa.String(500), nullable=True))
        batch.add_column(sa.Column("vehicle_class_used", sa.String(32), nullable=True))
        batch.add_column(sa.Column("toll_entry_point", sa.String(255), nullable=True))
        batch.add_column(sa.Column("toll_exit_point", sa.String(255), nullable=True))
        batch.add_column(sa.Column("toll_effective_date", sa.Date(), nullable=True))

    with op.batch_alter_table("trips") as batch:
        batch.add_column(sa.Column("estimated_toll_budget", sa.Float(), nullable=True))
        batch.add_column(sa.Column("additional_toll_total", sa.Float(), nullable=True))
        batch.add_column(sa.Column("toll_actual_total", sa.Float(), nullable=True))
        batch.add_column(sa.Column("toll_variance", sa.Float(), nullable=True))

    with op.batch_alter_table("trucks") as batch:
        batch.add_column(sa.Column("vehicle_class", sa.String(32), nullable=False, server_default="Class 3"))


def downgrade() -> None:
    with op.batch_alter_table("trucks") as batch:
        batch.drop_column("vehicle_class")
    with op.batch_alter_table("trips") as batch:
        batch.drop_column("toll_variance")
        batch.drop_column("toll_actual_total")
        batch.drop_column("additional_toll_total")
        batch.drop_column("estimated_toll_budget")
    with op.batch_alter_table("bookings") as batch:
        batch.drop_column("toll_effective_date")
        batch.drop_column("toll_exit_point")
        batch.drop_column("toll_entry_point")
        batch.drop_column("vehicle_class_used")
        batch.drop_column("toll_estimate_message")
        batch.drop_column("toll_matrix_matched")
        batch.drop_column("estimated_toll_budget_php")
    op.drop_table("historical_toll_records")
    op.drop_table("additional_toll_entries")
    op.drop_table("toll_matrix")

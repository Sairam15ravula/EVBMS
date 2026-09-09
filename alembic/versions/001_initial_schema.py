"""Initial schema with users, vehicles, battery_packs, alert_logs, and telemetry_frames TimescaleDB hypertable

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-08-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='driver'),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Vehicles table
    op.create_table(
        'vehicles',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('chemistry', sa.String(length=50), nullable=False),
        sa.Column('total_energy_kwh', sa.Float(), nullable=False),
        sa.Column('nominal_voltage', sa.Float(), nullable=False),
        sa.Column('owner_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # Battery Packs table
    op.create_table(
        'battery_packs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('vehicle_id', sa.String(length=50), nullable=False),
        sa.Column('serial_number', sa.String(length=100), nullable=False),
        sa.Column('initial_capacity_ah', sa.Float(), nullable=False),
        sa.Column('cell_count', sa.Integer(), nullable=False, server_default='96'),
        sa.Column('manufacture_date', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('serial_number'),
        sa.UniqueConstraint('vehicle_id')
    )

    # Telemetry Frames table (Composite Primary Key: timestamp, vehicle_id)
    op.create_table(
        'telemetry_frames',
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('vehicle_id', sa.String(length=50), nullable=False),
        sa.Column('voltage', sa.Float(), nullable=False),
        sa.Column('current', sa.Float(), nullable=False),
        sa.Column('temperature', sa.Float(), nullable=False),
        sa.Column('soc', sa.Float(), nullable=False),
        sa.Column('soh', sa.Float(), nullable=False),
        sa.Column('internal_resistance', sa.Float(), nullable=False),
        sa.Column('cell_voltages', sa.JSON(), nullable=True),
        sa.Column('active_anomalies', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('timestamp', 'vehicle_id')
    )
    op.create_index('idx_telemetry_vehicle_time', 'telemetry_frames', ['vehicle_id', 'timestamp'])

    # Alert Logs table
    op.create_table(
        'alert_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('vehicle_id', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('fault_code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('acknowledged', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_logs_timestamp'), 'alert_logs', ['timestamp'])
    op.create_index(op.f('ix_alert_logs_vehicle_id'), 'alert_logs', ['vehicle_id'])

    # Convert telemetry_frames into a TimescaleDB hypertable if extension is available
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
                PERFORM create_hypertable('telemetry_frames', 'timestamp', if_not_exists => TRUE);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_alert_logs_vehicle_id'), table_name='alert_logs')
    op.drop_index(op.f('ix_alert_logs_timestamp'), table_name='alert_logs')
    op.drop_table('alert_logs')
    op.drop_index('idx_telemetry_vehicle_time', table_name='telemetry_frames')
    op.drop_table('telemetry_frames')
    op.drop_table('battery_packs')
    op.drop_table('vehicles')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')

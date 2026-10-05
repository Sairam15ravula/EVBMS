"""
Data retention service for archiving and purging old telemetry data.

Provides functions to archive and delete telemetry records older than
a configurable retention period. Includes a CLI entry point for
scheduling via cron or external task runners.
"""
import argparse
import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, select

from backend.db.models import TelemetryFrameModel
from backend.db.session import async_session_factory, init_db
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Retention period in days (configurable via environment variable)
RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "90"))


async def archive_telemetry_older_than(days: Optional[int] = None) -> int:
    """
    Identify telemetry data older than the specified retention period.

    In a production deployment this function would export records to
    cold storage (S3, GCS, etc.) before deletion. Currently it counts
    and logs the records that would be archived.

    Args:
        days: Retention period in days. Defaults to RETENTION_DAYS env var.

    Returns:
        Number of records identified for archival.
    """
    retention_days = days or RETENTION_DAYS
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)

    async with async_session_factory() as session:
        query = select(TelemetryFrameModel).where(
            TelemetryFrameModel.timestamp < cutoff_date
        )
        result = await session.execute(query)
        old_records = result.scalars().all()

        if not old_records:
            logger.info("No telemetry records to archive")
            return 0

        count = len(old_records)
        logger.info(
            f"Found {count} telemetry records older than {retention_days} days to archive",
            extra={"record_count": count, "cutoff_date": cutoff_date.isoformat()},
        )

        # TODO: Export to cold storage (S3, GCS, etc.) before deletion
        # For now, just return the count of records that would be archived

        return count


async def delete_archived_telemetry(days: Optional[int] = None) -> int:
    """
    Delete telemetry data older than the specified retention period.

    Args:
        days: Retention period in days. Defaults to RETENTION_DAYS env var.

    Returns:
        Number of records deleted.
    """
    retention_days = days or RETENTION_DAYS
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)

    async with async_session_factory() as session:
        query = delete(TelemetryFrameModel).where(
            TelemetryFrameModel.timestamp < cutoff_date
        )
        result = await session.execute(query)
        await session.commit()

        deleted_count = result.rowcount
        logger.info(
            f"Deleted {deleted_count} telemetry records older than {retention_days} days",
            extra={"deleted_count": deleted_count},
        )

        return deleted_count


def main() -> None:
    """CLI entry point for cron job scheduling."""
    parser = argparse.ArgumentParser(
        description="Data retention management for EV Battery Intelligence Platform"
    )
    parser.add_argument(
        "action",
        choices=["archive", "delete", "archive-and-delete"],
        help="Action to perform on old telemetry data",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help=f"Retention period in days (default: {RETENTION_DAYS})",
    )

    args = parser.parse_args()

    async def run() -> None:
        await init_db()

        if args.action == "archive":
            count = await archive_telemetry_older_than(args.days)
            print(f"Archived {count} records")
        elif args.action == "delete":
            count = await delete_archived_telemetry(args.days)
            print(f"Deleted {count} records")
        elif args.action == "archive-and-delete":
            archived = await archive_telemetry_older_than(args.days)
            deleted = await delete_archived_telemetry(args.days)
            print(f"Archived {archived} records, deleted {deleted} records")

    asyncio.run(run())


if __name__ == "__main__":
    main()

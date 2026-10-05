"""
Structured JSON logging utility for the EV Battery Intelligence Platform.

Provides a get_logger() factory that returns loggers emitting JSON-formatted
records to stdout, suitable for containerized deployments and log aggregation
systems (ELK, Datadog, CloudWatch, etc.).
"""
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# Log level configurable via environment variable (default: INFO)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Standard LogRecord attributes that should not be duplicated in the JSON output
_STANDARD_ATTRS = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "message", "asctime", "taskName",
}


class JSONFormatter(logging.Formatter):
    """Custom formatter that renders log records as JSON strings."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "module": record.module,
            "message": record.getMessage(),
        }

        # Include any extra context passed via the `extra` parameter
        for key, value in record.__dict__.items():
            if key not in _STANDARD_ATTRS and not key.startswith("_"):
                log_entry[key] = value

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


def get_logger(name: str, context: Optional[Dict[str, Any]] = None) -> logging.Logger:
    """
    Factory function that creates a configured logger with JSON formatting.

    Args:
        name: Logger name (typically __name__).
        context: Optional dictionary of key-value pairs to include in every
                 log record emitted by this logger.

    Returns:
        A configured logging.Logger instance.
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)

    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

    if context:
        return logging.LoggerAdapter(logger, context)

    return logger

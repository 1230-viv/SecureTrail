"""
Structured logger for SecureTrail.
Every stage logs with a consistent prefix so traces can be correlated by job_id.
"""

import logging
import sys
from typing import Optional


def get_logger(name: str, job_id: Optional[str] = None) -> logging.Logger:
    """
    Return a logger with a consistent format that includes the module name
    and optionally a job_id prefix for request-scoped tracing.
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%SZ",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)

    return logger


class JobLogger:
    """Context-aware logger that prepends job_id to every message."""

    def __init__(self, job_id: str, component: str):
        self._log = get_logger(component)
        self._prefix = f"[job={job_id}]"

    def info(self, msg: str) -> None:
        self._log.info(f"{self._prefix} {msg}")

    def debug(self, msg: str) -> None:
        self._log.debug(f"{self._prefix} {msg}")

    def warning(self, msg: str) -> None:
        self._log.warning(f"{self._prefix} {msg}")

    def error(self, msg: str) -> None:
        self._log.error(f"{self._prefix} {msg}")

    def exception(self, msg: str) -> None:
        self._log.exception(f"{self._prefix} {msg}")

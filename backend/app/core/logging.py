import logging
import sys

from pythonjsonlogger import jsonlogger

from app.config.settings import settings


def setup_logging() -> None:
    """Configures structured JSON logging for Better Stack compatibility."""
    log_handler = logging.StreamHandler(sys.stdout)

    if settings.LOG_FORMAT.lower() == "json":
        formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%SZ",
        )
    else:
        formatter = logging.Formatter(
            fmt="[%(asctime)s] %(levelname)s [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    log_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [log_handler]
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

    # Suppress verbose loggers
    logging.getLogger("uvicorn.access").handlers = [log_handler]
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.DB_ECHO else logging.WARNING
    )


logger = logging.getLogger("app")

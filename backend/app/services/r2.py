"""
Cloudflare R2 upload service using aioboto3 (S3-compatible API).

R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
"""

import logging
import mimetypes
from pathlib import Path
import uuid

import aioboto3
from botocore.config import Config
from fastapi import HTTPException, UploadFile, status

from app.config.settings import settings

logger = logging.getLogger("app.services.r2")

# Base upload directory for local fallback (absolute path relative to backend root)
BASE_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"

# Allowed mime types and normalization mapping
_MIME_NORMALIZATION = {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "image/x-png": "image/png",
}

_ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/svg+xml",
}

_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _r2_endpoint() -> str:
    return f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"


def _is_r2_configured() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET_NAME
        and not settings.R2_ACCOUNT_ID.startswith("your-")
    )


async def _save_locally(file_data: bytes, content_type: str, folder: str) -> str:
    """Save file bytes locally and return public URL."""
    upload_dir = BASE_UPLOAD_DIR / folder
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = mimetypes.guess_extension(content_type) or ".jpg"
    ext = ext.replace(".jpe", ".jpg").replace(".jpeg", ".jpg")
    if content_type == "image/svg+xml":
        ext = ".svg"
    elif content_type == "image/avif":
        ext = ".avif"

    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        f.write(file_data)

    host = f"http://localhost:{settings.PORT}" if settings.PORT else "http://localhost:8000"
    public_url = f"{host}/uploads/{folder}/{filename}"
    logger.info("Saved image locally to %s -> %s", file_path, public_url)
    return public_url


async def upload_file_to_r2(file: UploadFile, folder: str = "uploads") -> str:
    """
    Validate and upload an image file to Cloudflare R2 under a specific folder.
    Falls back to local file storage when R2 is not configured or if R2 upload fails.
    """
    # ── Read file content first ───────────────────────────────────────────────
    data = await file.read()

    # ── Validate & normalize content type ────────────────────────────────────
    raw_content_type = (file.content_type or "").lower().strip()
    content_type = _MIME_NORMALIZATION.get(raw_content_type, raw_content_type)

    if not content_type or content_type not in _ALLOWED_TYPES:
        allowed_str = "JPEG, PNG, WebP, GIF, AVIF, SVG"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{file.content_type}'. Allowed types: {allowed_str}.",
        )

    # ── Check size ────────────────────────────────────────────────────────────
    if len(data) > _MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds limit ({_MAX_SIZE_BYTES // (1024 * 1024)} MB max).",
        )

    if not _is_r2_configured():
        return await _save_locally(data, content_type, folder)

    # ── Build unique object key ───────────────────────────────────────────────
    ext = mimetypes.guess_extension(content_type) or ".jpg"
    ext = ext.replace(".jpe", ".jpg").replace(".jpeg", ".jpg")
    if content_type == "image/svg+xml":
        ext = ".svg"
    elif content_type == "image/avif":
        ext = ".avif"
    object_key = f"{folder}/{uuid.uuid4().hex}{ext}"

    # ── Upload via aioboto3 with fallback to local ────────────────────────────
    try:
        session = aioboto3.Session()
        async with session.client(
            "s3",
            endpoint_url=_r2_endpoint(),
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        ) as s3:
            await s3.put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=object_key,
                Body=data,
                ContentType=content_type,
                CacheControl="public, max-age=31536000",
            )

        if settings.R2_PUBLIC_DOMAIN:
            public_url = f"https://{settings.R2_PUBLIC_DOMAIN.rstrip('/')}/{object_key}"
        else:
            public_url = f"{_r2_endpoint()}/{settings.R2_BUCKET_NAME}/{object_key}"

        logger.info("File uploaded to R2: %s", public_url)
        return public_url
    except Exception as exc:
        logger.warning("R2 upload failed (%s). Falling back to local file storage.", exc)
        return await _save_locally(data, content_type, folder)


async def upload_logo(file: UploadFile) -> str:
    """Upload logo image to Cloudflare R2 (or local fallback)."""
    return await upload_file_to_r2(file, folder="logos")


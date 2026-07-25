"""
Cloudflare R2 upload service using aioboto3 (S3-compatible API).

R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
"""

import logging
import mimetypes
import uuid

import aioboto3
from botocore.config import Config
from fastapi import HTTPException, UploadFile, status

from app.config.settings import settings

logger = logging.getLogger("app.services.r2")

# Only allow safe image formats
_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _r2_endpoint() -> str:
    return f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"


def _is_r2_configured() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET_NAME
    )


from pathlib import Path

async def upload_file_to_r2(file: UploadFile, folder: str = "uploads") -> str:
    """
    Validate and upload an image file to Cloudflare R2 under a specific folder.
    Falls back to local file storage when R2 is not configured.
    """
    if not _is_r2_configured():
        # Local file storage fallback
        upload_dir = Path("uploads") / folder
        upload_dir.mkdir(parents=True, exist_ok=True)

        content_type = file.content_type or "image/jpeg"
        ext = mimetypes.guess_extension(content_type) or ".jpg"
        ext = ext.replace(".jpe", ".jpg")
        filename = f"{uuid.uuid4().hex}{ext}"
        file_path = upload_dir / filename

        data = await file.read()
        with open(file_path, "wb") as f:
            f.write(data)

        host = f"http://localhost:{settings.PORT}" if settings.PORT else "http://localhost:8000"
        public_url = f"{host}/uploads/{folder}/{filename}"
        logger.info("Saved image locally to %s -> %s", file_path, public_url)
        return public_url

    # ── Validate content type ─────────────────────────────────────────────────
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{content_type}'. Allowed: {', '.join(_ALLOWED_TYPES)}",
        )

    # ── Read & size-check ─────────────────────────────────────────────────────
    data = await file.read()
    if len(data) > _MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File must be ≤ {_MAX_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    # ── Build a unique object key ─────────────────────────────────────────────
    ext = mimetypes.guess_extension(content_type) or ".jpg"
    ext = ext.replace(".jpe", ".jpg")  # normalize .jpe → .jpg
    object_key = f"{folder}/{uuid.uuid4().hex}{ext}"

    # ── Upload via aioboto3 ───────────────────────────────────────────────────
    session = aioboto3.Session()
    try:
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
    except Exception as exc:
        logger.error("R2 upload failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="File upload failed. Please try again later.",
        ) from exc

    # ── Return public URL ─────────────────────────────────────────────────────
    if settings.R2_PUBLIC_DOMAIN:
        public_url = f"https://{settings.R2_PUBLIC_DOMAIN.rstrip('/')}/{object_key}"
    else:
        # Fallback to direct R2 URL (requires bucket public access)
        public_url = f"{_r2_endpoint()}/{settings.R2_BUCKET_NAME}/{object_key}"

    logger.info("File uploaded: %s", public_url)
    return public_url


async def upload_logo(file: UploadFile) -> str:
    """Upload logo image to Cloudflare R2."""
    return await upload_file_to_r2(file, folder="logos")

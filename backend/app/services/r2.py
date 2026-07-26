"""
Supabase Storage Service.
Handles image validation and direct uploads to Supabase Storage.
"""

import logging
import mimetypes
import uuid

import httpx
from fastapi import HTTPException, UploadFile, status

from app.config.settings import settings

logger = logging.getLogger("app.services.storage")

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


def _is_supabase_configured() -> bool:
    return bool(
        settings.SUPABASE_URL
        and settings.SUPABASE_KEY
        and settings.SUPABASE_BUCKET_NAME
        and not settings.SUPABASE_URL.startswith("your-")
    )


async def upload_file_to_supabase(file: UploadFile, folder: str = "uploads") -> str:
    """
    Validate and upload an image file directly to Supabase Storage under a specific folder.
    Returns the public HTTPS URL for the uploaded object.
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

    if not _is_supabase_configured():
        logger.error("Supabase Storage is not configured in settings.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage is not properly configured. SUPABASE_URL, SUPABASE_KEY, and SUPABASE_BUCKET_NAME are required.",
        )

    ext = mimetypes.guess_extension(content_type) or ".jpg"
    ext = ext.replace(".jpe", ".jpg").replace(".jpeg", ".jpg")
    if content_type == "image/svg+xml":
        ext = ".svg"
    elif content_type == "image/avif":
        ext = ".avif"

    filename = f"{uuid.uuid4().hex}{ext}"
    object_path = f"{folder}/{filename}"

    base_url = settings.SUPABASE_URL.rstrip("/")
    bucket = settings.SUPABASE_BUCKET_NAME.strip()

    upload_url = f"{base_url}/storage/v1/object/{bucket}/{object_path}"
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        "apiKey": settings.SUPABASE_KEY,
        "Content-Type": content_type,
        "x-upsert": "true",
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(upload_url, content=data, headers=headers)
            if resp.status_code not in (200, 201):
                logger.error("Supabase Storage upload failed [%s]: %s", resp.status_code, resp.text)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Supabase Storage error ({resp.status_code}): {resp.text}",
                )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to upload file to Supabase Storage: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file to storage: {str(exc)}",
        ) from exc

    public_url = f"{base_url}/storage/v1/object/public/{bucket}/{object_path}"
    logger.info("File successfully uploaded to Supabase Storage: %s", public_url)
    return public_url


# Backward-compatible alias exports
upload_file_to_r2 = upload_file_to_supabase


async def upload_logo(file: UploadFile) -> str:
    """Upload logo image to Supabase Storage."""
    return await upload_file_to_supabase(file, folder="logos")

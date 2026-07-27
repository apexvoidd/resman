"""Clerk JWT verification using JWKS (RS256).

PyJWT's PyJWKClient automatically fetches and caches the public keys
from Clerk's JWKS endpoint, so no manual key management is needed.
"""

import logging
from functools import lru_cache

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient, PyJWTError

from app.config.settings import settings

logger = logging.getLogger("app.security")


def _get_jwks_url() -> str:
    if settings.CLERK_JWKS_URL:
        return settings.CLERK_JWKS_URL
    if settings.CLERK_ISSUER:
        return f"{settings.CLERK_ISSUER.rstrip('/')}/.well-known/jwks.json"
    return ""


@lru_cache(maxsize=1)
def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    """Returns a cached JWKS client."""
    return PyJWKClient(jwks_url)


def verify_clerk_token(token: str) -> dict:
    """
    Verify a Clerk-issued Bearer token and return decoded JWT claims.

    Claims include:
        sub   — Clerk user ID (e.g. "user_2abc...")
        iss   — Clerk issuer domain
        email — from public metadata (if configured as session claim)
    """
    jwks_url = _get_jwks_url()
    if not jwks_url:
        logger.warning("Clerk JWKS URL is not configured.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication server configuration missing on backend.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        client = _get_jwks_client(jwks_url)
        signing_key = client.get_signing_key_from_jwt(token)
        payload: dict = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            # Clerk does not set `aud` by default; disable audience verification
            options={"verify_aud": False},
        )

        # Optionally validate issuer when configured
        if settings.CLERK_ISSUER and payload.get("iss") != settings.CLERK_ISSUER:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token issuer.",
            )

        return payload

    except HTTPException:
        raise
    except PyJWTError as exc:
        logger.warning("JWT verification failed: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as exc:
        logger.error("Unexpected error during Clerk JWT verification: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

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


@lru_cache(maxsize=1)
def _get_jwks_client() -> PyJWKClient:
    """Returns a cached JWKS client. Called once per process lifetime."""
    if not settings.CLERK_JWKS_URL:
        raise RuntimeError(
            "CLERK_JWKS_URL is not configured. "
            "Set it to https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json"
        )
    return PyJWKClient(settings.CLERK_JWKS_URL)


def verify_clerk_token(token: str) -> dict:
    """
    Verify a Clerk-issued Bearer token and return decoded JWT claims.

    Claims include:
        sub  — Clerk user ID (e.g. "user_2abc...")
        iss  — Clerk issuer domain
        email — from public metadata (if configured as session claim)
    """
    try:
        client = _get_jwks_client()
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

    except PyJWTError as exc:
        logger.warning("JWT verification failed: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

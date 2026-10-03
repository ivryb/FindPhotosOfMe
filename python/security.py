import os
import secrets

from fastapi import Header, HTTPException


def require_service_token(authorization: str | None = Header(None)) -> None:
    expected = os.getenv("SERVICE_TOKEN")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not expected or not secrets.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")

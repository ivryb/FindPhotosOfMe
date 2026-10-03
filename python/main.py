"""FastAPI submission endpoints; Modal workers own long-running processing."""

import os
import sys
from collections.abc import Awaitable, Callable

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from fastapi import FastAPI
from endpoints.upload_collection import router as upload_router
from endpoints.search_photos import router as search_router

load_dotenv()


def create_app(
    submit_ingest: Callable[[str, str, str], Awaitable[object]] | None = None,
    execute_search: Callable[[str, bytes], Awaitable[object]] | None = None,
) -> FastAPI:
    app = FastAPI(title="Find Photos of Me - Processing Service", version="2.0.0")
    app.state.submit_ingest = submit_ingest
    app.state.execute_search = execute_search
    app.include_router(upload_router, prefix="/api", tags=["upload"])
    app.include_router(search_router, prefix="/api", tags=["search"])

    @app.get("/")
    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": "find-photos-of-me-processing", "version": "2.0.0"}

    return app


app = create_app()

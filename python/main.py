"""FastAPI submission endpoints; Modal workers own long-running processing."""

import os
import sys
from collections.abc import Awaitable, Callable

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from fastapi import FastAPI
from endpoints.photo_batches import router as batches_router
from endpoints.search_photos import router as search_router

load_dotenv()


def create_app(
    submit_batch: Callable[[str], Awaitable[object]] | None = None,
    submit_merge: Callable[[str, list[str]], Awaitable[object]] | None = None,
    execute_search: Callable[[str, bytes], Awaitable[object]] | None = None,
) -> FastAPI:
    app = FastAPI(title="Find Photos of Me - Processing Service", version="2.0.0")
    app.state.submit_batch = submit_batch
    app.state.submit_merge = submit_merge
    app.state.execute_search = execute_search
    app.include_router(batches_router, prefix="/api", tags=["photos"])
    app.include_router(search_router, prefix="/api", tags=["search"])

    @app.get("/")
    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": "find-photos-of-me-processing", "version": "2.0.0"}

    return app


app = create_app()

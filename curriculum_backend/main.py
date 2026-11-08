import hmac
import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException

from .router import router
from .database import ensure_indexes, get_client, get_collection
from .assignments import router as assignment_router
from .recommendations import router as recommendations_router

logger = logging.getLogger(__name__)


def authenticate_service(authorization: Annotated[str | None, Header()] = None) -> None:
    token = os.environ.get("CURRICULUM_SERVICE_TOKEN", "")
    if len(token) < 32:
        logger.error("CURRICULUM_SERVICE_TOKEN must contain at least 32 characters")
        raise HTTPException(status_code=503, detail="Curriculum service is not configured")
    expected = f"Bearer {token}".encode("utf-8")
    supplied = (authorization or "").encode("utf-8")
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid service credentials")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        ensure_indexes(get_collection())
        yield
    finally:
        if get_client.cache_info().currsize:
            get_client().close()
            get_client.cache_clear()


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.include_router(router, dependencies=[Depends(authenticate_service)])
app.include_router(assignment_router, dependencies=[Depends(authenticate_service)])
app.include_router(recommendations_router, dependencies=[Depends(authenticate_service)])

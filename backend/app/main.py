"""Issue Finder Web API — FastAPI application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import init_db
from .core.seed import seed_admin
from .api import admin, auth, discovery, history, notifications, oauth, websocket


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_admin()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(oauth.router)
app.include_router(discovery.router)
app.include_router(history.router)
app.include_router(notifications.router)
app.include_router(websocket.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}

"""WebSocket endpoints for real-time streaming."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import async_session
from ..models.user import User
from ..services.github_service import GitHubService

router = APIRouter(tags=["websocket"])
log = logging.getLogger(__name__)


async def _get_token_from_db(user_id: int | None) -> str | None:
    if not user_id:
        return None
    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        return user.github_token if user else None


@router.websocket("/ws/discover")
async def ws_discover(
    websocket: WebSocket,
    sources: str = Query("trending,topics,curated"),
    max_repos: int = Query(30),
    token: str = Query(None),
):
    await websocket.accept()
    service = GitHubService(token=token)
    try:
        src = tuple(s.strip() for s in sources.split(","))
        async for event in service.discover_stream(sources=src, max_repos=max_repos):
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        await service.close()


@router.websocket("/ws/issues/{owner}/{name}")
async def ws_issues(
    websocket: WebSocket,
    owner: str,
    name: str,
    max_issues: int = Query(100),
    token: str = Query(None),
):
    await websocket.accept()
    service = GitHubService(token=token)
    try:
        async for event in service.get_issues_stream(f"{owner}/{name}", max_issues=max_issues):
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        await service.close()


@router.websocket("/ws/scan/{owner}/{name}")
async def ws_scan(
    websocket: WebSocket,
    owner: str,
    name: str,
    max_issues: int = Query(100),
    token: str = Query(None),
):
    await websocket.accept()
    service = GitHubService(token=token)
    try:
        async for event in service.scan_repo_stream(f"{owner}/{name}", max_issues=max_issues):
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        await service.close()


@router.websocket("/ws/autoscan")
async def ws_autoscan(
    websocket: WebSocket,
    max_repos: int = Query(10),
    token: str = Query(None),
):
    await websocket.accept()
    service = GitHubService(token=token)
    try:
        async for event in service.autoscan_stream(max_repos=max_repos):
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        await service.close()

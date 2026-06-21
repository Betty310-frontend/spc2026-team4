from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_async_db, get_redis_client
from app.dto.chat import ChatRequest
from app.services.chat import stream_ui

router = APIRouter()


@router.post('/chat')
async def handle_chat(
    body: ChatRequest,
    db: AsyncSession = Depends(get_async_db),
    redis: Redis = Depends(get_redis_client),
) -> StreamingResponse:
    return StreamingResponse(
        stream_ui(
            body.messages,
            conversation_id=body.id,
            current_station=body.station,
            current_radius=body.radius,
            current_category=body.category,
            db=db,
            redis=redis,
        ),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Vercel-AI-UI-Message-Stream': 'v1',
            'X-Accel-Buffering': 'no',
        },
    )

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.dto.chat import ChatRequest
from app.services.chat import get_market_data, stream_ui

router = APIRouter()


@router.post('/chat')
async def handle_chat(body: ChatRequest) -> StreamingResponse:
    market_data = await get_market_data(body.station, body.radius, body.category)
    return StreamingResponse(
        stream_ui(body.messages, market_data),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Vercel-AI-UI-Message-Stream': 'v1',
            'X-Accel-Buffering': 'no',
        },
    )

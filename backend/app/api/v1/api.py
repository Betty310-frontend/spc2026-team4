from fastapi import APIRouter

from app.api.v1.controllers import chat

router = APIRouter()

router.include_router(chat.router, tags=['chat'])

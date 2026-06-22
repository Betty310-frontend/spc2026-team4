from fastapi import APIRouter

from app.api.v1.controllers import analysis, chat

router = APIRouter()

router.include_router(chat.router, tags=['chat'])
router.include_router(analysis.router, prefix='/analysis', tags=['analysis'])

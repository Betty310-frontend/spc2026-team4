from fastapi import APIRouter

from app.api.v1.controllers import analysis, chat, health, report

router = APIRouter()

router.include_router(health.router, tags=['health'])
router.include_router(chat.router, tags=['chat'])
router.include_router(analysis.router, tags=['analysis'])
router.include_router(report.router, tags=['report'])

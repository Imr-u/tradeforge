from fastapi import APIRouter
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.trades import router as trades_router
from app.api.v1.endpoints.accounts import router as accounts_router
from app.api.v1.endpoints.analytics import router as analytics_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(trades_router, prefix="/trades", tags=["trades"])
api_router.include_router(accounts_router, prefix="/accounts", tags=["accounts"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
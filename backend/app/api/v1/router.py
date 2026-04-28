from fastapi import APIRouter
from app.api.v1.endpoints.auth import router as auth_router

api_router = APIRouter()
api_router.include_router(auth_router)

# Future routes added here:
# from app.api.v1.endpoints.trades import router as trades_router
# from app.api.v1.endpoints.accounts import router as accounts_router
# from app.api.v1.endpoints.analytics import router as analytics_router
# from app.api.v1.endpoints.playbooks import router as playbooks_router
# from app.api.v1.endpoints.mentor import router as mentor_router

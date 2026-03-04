from app.core.config import settings
from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health")
def health():
    return {"status": "ok"}

@router.get("/version")
def version():
    return {"app": settings.app_name, "env": settings.env, "version": "0.1.0"}

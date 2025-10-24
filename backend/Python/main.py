from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints.calculate import router as calculate_router
from app.api.v1.endpoints.models import router as models_router
from app.core.config import settings


app = FastAPI(title="FutureCity API", version="0.1.0")

# CORS設定（フロントエンドからのアクセスを許可）
cors_origins = settings.cors_origins.split(",") if settings.cors_origins else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "message": "API is running"}

@app.get("/info")
def info():
    return {
        "name": "FutureCity API",
        "version": "0.1.0",
        "description": "3D都市可視化アプリケーションのバックエンドAPI"
    }


# お試しAPI
@app.get("/example")
def example():
    return {"message": "Hello, World!"}

# v1 routers
app.include_router(calculate_router, prefix="/api/v1", tags=["calculate"])
app.include_router(models_router, prefix="/api/v1", tags=["models"])


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints.calculate import router as calculate_router
from app.api.v1.endpoints.models import router as models_router
from app.api.v1.endpoints.analysis import router as analysis_router
from app.api.v1.endpoints.damage_prediction import router as damage_prediction_router
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

# v1 routers
try:
    app.include_router(calculate_router, prefix="/api/v1", tags=["calculate"])
    print("Calculate router registered")
    
    app.include_router(models_router, prefix="/api/v1", tags=["models"])
    print("Models router registered")
    
    app.include_router(analysis_router, prefix="/api/v1", tags=["analysis"])
    print("Analysis router registered")

    app.include_router(damage_prediction_router, prefix="/api/v1", tags=["damage_prediction"])
    print("Seismic router registered")
    
    print("All routers registered successfully!")
except Exception as e:
    print(f"Router registration error: {e}")
    import traceback
    traceback.print_exc()


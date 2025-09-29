from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FutureCity API", version="0.1.0")

# CORS設定（フロントエンドからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Viteのデフォルトポート
    allow_credentials=True,
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

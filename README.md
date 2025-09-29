# FutureCityVisualizationApp

3D都市可視化アプリケーション（Cesium.js + FastAPI）

## 環境準備

### 必要なツール
- **Node.js LTS** (18.x以上)
- **Python 3.10+** (ローカル実行時のみ)
- **Docker Desktop** (コンテナ実行時)
- **Git**

### フロントエンド
JavaScript + Vite + Cesium.js

```bash
# 依存関係インストール
cd frontend
npm ci

# 開発サーバー起動
npm run dev
# → http://localhost:5173 でアクセス
```

### バックエンド
Python + FastAPI

```bash
# 依存関係インストール
cd backend/Python
pip install -r requirements.txt

# サーバー起動
python app.py
# → http://localhost:8000 でアクセス
```

### Docker で起動

```bash
# フロントエンドのみ
docker-compose up frontend

# 全サービス
docker-compose up --build
```

## API エンドポイント

- `GET /api/v1/health` - ヘルスチェック
- `GET /api/v1/info` - アプリ情報

## 開発

### フロントエンド
- メインエントリ: `frontend/src/main.js`
- 3Dビューア: `frontend/src/app/viewer.js`
- UI制御: `frontend/src/app/controls/`

### バックエンド
- メインエントリ: `backend/Python/app.py`
- API設定: `backend/Python/app/main.py`

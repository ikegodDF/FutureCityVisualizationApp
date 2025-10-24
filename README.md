# FutureCityVisualizationApp

3D都市可視化アプリケーション（Cesium.js + FastAPI）

## 環境準備

### 必要なツール
- **Node.js LTS** (18.x以上)
- **Python 3.10+** (ローカル実行時のみ)
- **Docker Desktop** (コンテナ実行時)
- **Git**

### 環境変数の設定
```bash
# .env.example をコピーして .env を作成
cp .env.example .env

# .env ファイルを編集して必要な値を設定
# - VITE_CESIUM_ION_TOKEN: Cesium Ion のアクセストークン
# - VITE_API_BASE_URL: バックエンドAPIのURL
```

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
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
# → http://localhost:8000/docs でアクセス
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

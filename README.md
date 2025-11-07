# FutureCityVisualizationApp

3D都市可視化アプリケーション（Cesium.js + FastAPI）

<img width="960" height="454" alt="Image" src="https://github.com/user-attachments/assets/e7ab411c-cc31-4629-9c5e-0cfc3d65bd2c" />
<br>
<img width="960" height="512" alt="Image" src="https://github.com/user-attachments/assets/7e567bca-9cb8-448f-851e-1faaf78d68f7" />
<br>
<img width="812" height="427" alt="Image" src="https://github.com/user-attachments/assets/94067224-9907-467c-a3fc-24f5d7a81a7d" />

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

from datetime import datetime
import time
from fastapi import APIRouter

# ※型定義に合わせて適宜インポートを調整してください
from app.models.schemas import DistributionRequest, DistributionResponse
from app.services.seismic_data_service import SeismicDataService
from app.services.tsunami_data_service import TsunamiDataService

router = APIRouter(prefix="/get_distribution")

# サーバー起動時に1回だけインスタンス化（中身はまだ空）
get_seismic_service = SeismicDataService()
get_tsunami_service = TsunamiDataService()

@router.post("/", response_model=DistributionResponse)
def get_distribution(request: DistributionRequest):
    # 1. 処理時間の計測開始
    start_time = time.time()
    
    # 2. データをロード（すでにロード済みの場合は内部キャッシュでスキップされます）
    get_seismic_service.ensure_loaded_from_directory()
    get_tsunami_service.ensure_loaded_from_directory()
    
    # 3. フロント返却用のデータをそれぞれのサービスから取得
    # ※前回の「既存コードを汚さない追加関数」を呼び出しています
    export = {
        "seismic": get_seismic_service.get_distribution(),
        "tsunami": get_tsunami_service.get_distribution()
    }
    
    # 4. かかった時間をミリ秒（ms）に変換
    duration = (time.time() - start_time) * 1000
    
    # 5. Pydanticモデル（DistributionResponse）の形式に整えて返却
    return DistributionResponse(
        distribution=export,  # 配列（List）の中に津波と震度の辞書を格納
        duration_ms=duration,
        timestamp=datetime.now()
    )
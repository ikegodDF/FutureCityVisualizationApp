from fastapi import APIRouter
from app.models.schemas import ComputeRequest, ComputeResponse
from app.services.get_seismic_service import GetSeismicService
from app.services.compute_service import ComputeService
from app.services.get_tsunami_service import GetTsunamiService
# 👑 さっき作った避難データ専用のサービスをインポート
from app.services.get_evacuation_service import GetEvacuationService
import time

router = APIRouter(prefix="/damage_prediction")
get_seismic_service = GetSeismicService()
compute_service = ComputeService()
get_tsunami_service = GetTsunamiService()
# 👑 避難データサービスのインスタンスを生成
get_evacuation_service = GetEvacuationService()

@router.post("/earthquake", response_model=ComputeResponse)
def damage_prediction(request: ComputeRequest):
    start_time = time.time()
    request.params = get_seismic_service.get_seismic_data_with_policy(
        request.params,
        missing_data_policy=request.missing_data_policy,
    )
    return compute_service.compute(request)


@router.post("/tsunami", response_model=ComputeResponse)
def tsunami_damage_prediction(request: ComputeRequest):
    start_time = time.time()
    
    # 1. 既存の津波浸水深データ・施策の適用処理
    request.params = get_tsunami_service.get_tsunami_data_with_policy(
        request.params,
        missing_data_policy=request.missing_data_policy,
    )
    
    # 👑 2. 【さっき作った関数を適応】
    # 配列のインデックス(順番)がCSVと1:1で完全一致している前提で、
    # 避難先名称や死亡人口などのリッチなCSV属性を request.params 内の各建物へ高速マージ！
    request.params = get_evacuation_service.merge_evacuation_data_with_policy(
        request.params,
        missing_data_policy=request.missing_data_policy,
    )
    
    # 3. 津波・避難データをすべて内包した状態で、最終的な被害計算（victimsの集計など）を実行
    return compute_service.compute(request)
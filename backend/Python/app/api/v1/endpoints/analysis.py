from fastapi import APIRouter
from app.models.schemas import ComputeRequest, AnalysisResponse
from app.services.analysis_service import AnalysisService
from datetime import datetime
import copy

router = APIRouter(prefix="/analysis")
analysis_service = AnalysisService()

@router.post("/", response_model=AnalysisResponse)
def analysis(request: ComputeRequest):
    results = []
    for i in range(1000):
        
        # 元のパラメータから完全に新しいリクエストを作成
        original_params_copy = copy.deepcopy(request.params)
        current_request = ComputeRequest(
            method=request.method,
            appStateYear=request.appStateYear,
            params=original_params_copy
        )
        
        # 新しいサービスインスタンス
        fresh_service = AnalysisService()
        
        # 分析実行
        result = fresh_service.analyze(current_request)
        results.append(result)
        
    
    return AnalysisResponse(
        result=results,
        duration_ms=0.0,
        timestamp=datetime.now()
    )
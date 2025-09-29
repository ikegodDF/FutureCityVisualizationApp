import time
from datetime import datetime
from typing import Dict, Any
from ..models.schemas import ComputeRequest, ComputeResponse

class ComputeService:
    def __init__(self):
        self.cache = {}  # 簡単なメモリキャッシュ
    
    def compute(self, request: ComputeRequest) -> ComputeResponse:
        """計算リクエストを処理"""
        start_time = time.time()
        
        # キャッシュキー生成
        cache_key = f"{request.method}_{hash(str(request.params))}"
        
        # キャッシュチェック
        if cache_key in self.cache:
            cached_result = self.cache[cache_key]
            return ComputeResponse(
                result=cached_result,
                duration_ms=0.1,  # キャッシュヒット
                timestamp=datetime.now()
            )
        
        # 実際の計算
        result = self._execute_computation(request.method, request.params)
        
        # キャッシュに保存
        self.cache[cache_key] = result
        
        duration_ms = (time.time() - start_time) * 1000
        
        return ComputeResponse(
            result=result,
            duration_ms=duration_ms,
            timestamp=datetime.now()
        )
    
    def _execute_computation(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """実際の計算ロジック"""
        if method == "building_density":
            return self._calculate_building_density(params)
        elif method == "height_analysis":
            return self._calculate_height_analysis(params)
        else:
            return {"error": f"Unknown method: {method}"}
    
    def _calculate_building_density(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """建物密度計算"""
        # 実際の計算ロジック
        return {
            "density": 0.85,
            "total_buildings": 150,
            "area_km2": 2.5
        }
    
    def _calculate_height_analysis(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """高さ分析"""
        return {
            "average_height": 45.2,
            "max_height": 120.5,
            "height_distribution": {"low": 30, "medium": 80, "high": 40}
        }
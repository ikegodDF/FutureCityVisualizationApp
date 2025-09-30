import time
from datetime import datetime
from typing import Dict, Any, List
import math
from scipy.stats import norm
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
    
    def _calculate_building_retention_rate(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """建物存続確率分析"""
        bulding_Age = params.get("bulding_Age")

        return {
            "retention_rate": 0.85,
            "total_buildings": 150,
            "area_km2": 2.5
        }
    
    def _calculate_earthquake_damage_assessment(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """地震被害判定"""
        # 計算パラメータ(木造)
        caluculateparam_wood: Dict[str, List[int]] = {
            "lambda_complete": [6.514, 6.432, 6.432, 6.432, 6.432, 6.659, 6.659],
            "lambda_partial": [6.367, 6.343, 6.343, 6.343, 6.343, 6.433, 6.433],
            "devaiation_complete": [0.187, 0.133, 0.133, 0.133, 0.133, 0.183, 0.183],
            "devaiation_partial": [0.205, 0.157, 0.157, 0.157, 0.157, 0.169, 0.169]
        }

        # 計算パラメータ（非木造）
        caluculateparam_concrete: Dict[str, List[int]] = {
            "lambda_complete": [6.887, 6.768, 6.768, 6.614, 6.614],
            "lambda_partial": [6.493, 6.449, 6.449, 6.51, 6.51],
            "devaiation_complete": [0.319, 0.353, 0.353, 0.063, 0.063],
            "devaiation_partial": [0.184, 0.231, 0.231, 0.175, 0.175]
        }

        structureType = params.get("structureType")
        architecturalPeriod = params.get("architecturalPeriod")
        earthquake_intensity = params.get("earthquake_intensity")

        if structureType == "wood":
            caluculateparam = caluculateparam_wood
        elif structureType == "concrete":
            caluculateparam = caluculateparam_concrete
            damageRate = norm.cdf((math.log(earthquake_intensity) - caluculateparam[f"lambda_complete"][architecturalPeriod]) / caluculateparam[f"devaiation_complete"][architecturalPeriod])

        return {
            "damage_rate": damageRate
        }
    
    def _calculate_thunami_damage_assessment(self, params: Dict[str, ]) -> Dict[str, Any]:
        """津波被害判定"""
        # 計算パラメータ（木造）
        caluculateparam_wood: Dict[str, List[int]] = {
            "section": [-3.444, -3.349],
            "floodDepth": [1.088, 1.603],
            "floors": [-0.6844, -0.5398],
            "area": [-0.003809, -0.001909],
            "artitecuturalPeriod1": [0, 0],
            "architecuturalPeriod2": [-0.1208, -0.001909],
            "architecuturalPeriod3": [0.3251, 0.05358],
            "architecuturalPeriod4": [-0.0391, -0.2634],
            "architecuturalPeriod5": [-0.2955, -0.6985],
            "architecuturalPeriod6": [-0.6426, -1.054],
            "purpose1": [0, 0],
            "purpose2": [0.002743, 0.2321],
            "purpose3": [0.09565, 0.08084],
            "purpose4": [0.1265, 0.1915],
            "purpose5": [-0.1531, -0.1856],
            "purpose6": [-0.9844, -0.5882],
            "devaiation": [1.532, 2.072]
        }

        # 計算パラメータ（非木造）
        calculateparam_concrete: Dict[str, List[int]] = {
            "section": [-5.966, -3.406],
            "floodDepth": [0.4584, 0.7256],
            "floors": [-0.5606, -0.5351],
            "area": [-0.001065, -0.0004088],
            "structureType1": [0, 0],
            "structureType2": [1.76, 1.504],
            "structureType4": [2.268, 1.403],
            "artitecuturalPeriod1": [0, 0],
            "architecuturalPeriod2": [0.0003355, 0.1627],
            "architecuturalPeriod3": [0.003832, -0.009885],
            "architecuturalPeriod4": [-0.4716, -0.5078],
            "purpose1": [0, 0],
            "purpose2": [-0.2879, -0.3954],
            "purpose3": [-0.175, -0.5347],
            "purpose4": [0.1698, -0.5778],
            "purpose5": [0.2988, -0.1339],
            "purpose6": [-0.4998, -0.6209],
            "devaiation": [1.92, 1.605]
        }

        judgementparam = 0
        floodDepth = params.get("floodDepth")
        floors = params.get("floors")
        area = params.get("area")
        structureType = params.get("structureType")
        architecturalPeriod = params.get("architecturalPeriod")
        purpose = params.get("purpose")

        if structureType == "wood":
            caluculateparam = caluculateparam_wood
        elif structureType == "concrete":
            caluculateparam = calculateparam_concrete
        else:
            caluculateparam = {}
        
        damageRate = 1/(1+math.exp( caluculateparam["section"][judgementparam] + calcuclateparam["floodDepth"] * floodDepth + calcuclateparam["floors"][judgementparam] * floors + calcuclateparam["area"][judgementparam] * area + calcuclateparam[f"architecuturalPeriod{architecturalPeriod}"][judgementparam] * architecturalPeriod + calcuclateparam[f"purpose{purpose}"][judgementparam] * purpose + calcuclateparam["devaiation"][judgementparam]))


        return {
            "damage_rate": damageRate
        }
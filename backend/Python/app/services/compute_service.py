import time
from datetime import datetime
from typing import Dict, Any, List, Optional, Literal
import math
import random
import numpy as np
from scipy.stats import norm, truncnorm
from ..models.schemas import ComputeRequest, ComputeResponse, Model3D
from .seismic_data_service import SeismicDataService

class ComputeService:
    def __init__(self):
        self.cache = {}  # 簡単なメモリキャッシュ
        self.enable_cache = False  # 開発中はキャッシュ無効
        self.seismic_data_service = SeismicDataService()
        self.seismic_data_service.ensure_loaded_from_directory()
    
    def compute(self, request: ComputeRequest) -> ComputeResponse:
        """計算リクエストを処理"""
        start_time = time.time()
        
        # キャッシュキー生成（必要時のみ）
        missing_data_policy = getattr(request, "missing_data_policy", "fallback_fixed")
        cache_key = f"{request.method}_{request.appStateYear}_{missing_data_policy}_{hash(str(request.params))}"
        
        # キャッシュチェック（有効時のみ）
        if self.enable_cache and cache_key in self.cache:
            cached_result = self.cache[cache_key]
            return ComputeResponse(
                result=cached_result,
                duration_ms=0.1,  # キャッシュヒット
                timestamp=datetime.now()
            )
        
        # 実際の計算
        result = self._execute_computation(
            request.method,
            request.params,
            request.appStateYear,
            missing_data_policy=missing_data_policy,
        )
        
        # キャッシュに保存（有効時のみ）
        if self.enable_cache:
            self.cache[cache_key] = result
        
        duration_ms = (time.time() - start_time) * 1000
        
        return ComputeResponse(
            result=result,
            duration_ms=duration_ms,
            timestamp=datetime.now()
        )
    
    def _execute_computation(
        self,
        method: str,
        params: List[Model3D],
        appStateYear: int,
        *,
        missing_data_policy: str = "fallback_fixed",
    ) -> List[Model3D]:
        """実際の計算ロジック"""
        results = []
        building_Num = len([p for p in params if p.show == False])
        if building_Num == 0:
            building_Num = 1
        
        # 1. パラメーターの定義
        historical_mean = 39.62
        historical_std_dev = 32.80
        # building_Num は上で計算済み（showがFalseの建物数）
        # コメント: 分母となる比較対象の建物数は既に計算済み

        # 2. 四分位範囲 (Q1とQ3) の定義
        a_min_limit = 19  # 最小値 (Q1)
        b_max_limit = 67  # 最大値 (Q3)

        # 3. 切断正規分布のためのパラメーター計算
        # truncnormは、標準正規分布 (μ=0, σ=1) の範囲を定義するため、
        # aとbの値を標準化（Zスコア化）する必要があります。

        # 標準化: Z = (X - μ) / σ
        a = (a_min_limit - historical_mean) / historical_std_dev
        b = (b_max_limit - historical_mean) / historical_std_dev

        # 4. 切断正規分布から乱数生成
        # loc=μ, scale=σ で元の分布のスケールに戻します
        # size=1 で1つの乱数を生成
        random_number_array = truncnorm.rvs(a, b, loc=historical_mean, scale=historical_std_dev, size=1)

        # 5. 建物数として処理（整数に丸める）
        # 生成される値は既に範囲内にあるため、クリッピング(a_min=0)は不要ですが、
        # 念のため0未満にならないよう処理し、整数に丸めます。
        generated_building_count = np.round(np.clip(random_number_array, a_min=0, a_max=None)).astype(int)[0]
        print("建物数乱数", generated_building_count)
        new_building_Num = 0
        for param in params:
            if method == "building_retention_rate":
                result, num = self._calculate_building_retention_rate(param, appStateYear, building_Num, generated_building_count)
                new_building_Num += num
            elif method == "earthquake_damage_assessment":
                if param.show == True:
                    result = self._calculate_earthquake_damage_assessment(param, missing_data_policy=missing_data_policy)
                else:
                    result = param
            elif method == "thunami_damage_assessment":
                if param.show == True:
                    result = self._calculate_thunami_damage_assessment(param, missing_data_policy=missing_data_policy)
                else:
                    result = param

            results.append(result)
            
        print("増えた建物数", new_building_Num)
        return results
    
    def _calculate_building_retention_rate(self, param: Model3D, appStateYear: int, building_Num: int, generated_building_count: int) -> Model3D:
        """建物存続確率分析"""
        # 築年齢別建物の確率
        calculateparam_age: Dict[str, List[float]] = {
            "under_5": [0, 0.059832469],
            "under_15": [0.099594893, 0.059832469],
            "under_25": [0.059156657, 0.059832469],
            "under_35": [0.094209708, 0.059832469],
            "under_45": [0.264274535, 0.059832469],
            "over_46": [0.390645831, 0.059832469],
            "no_data": [0.142936261, 0.059832469]
        }

        # yearがNoneのときはno_data扱い
        if param.year == 0:
            building_AgeType = "no_data"
            
        else:
            building_Age  = appStateYear - 5 - param.year

            if building_Age < 6:
                building_AgeType = "under_5"
            elif building_Age < 16:
                building_AgeType = "under_15"
            elif building_Age < 26:
                building_AgeType = "under_25"
            elif building_Age < 36:
                building_AgeType = "under_35"
            elif building_Age < 46:
                building_AgeType = "under_45"
            else:
                building_AgeType = "over_46"


        lost_probability = calculateparam_age[building_AgeType][0]
        revival_probability = calculateparam_age[building_AgeType][1]


        # 特定範囲数からランダムで復活
        # revival_probability = generated_building_count / building_Num

        judgement = random.random()
        
        num = 0
        if param.show == True:
            if judgement < lost_probability:
                param.show = False
        else:
            if judgement < revival_probability:
                param.show = True
                param.year = appStateYear
                num = 1
        return param, num

    
    def _calculate_earthquake_damage_assessment(
        self,
        param: Model3D,
        *,
        missing_data_policy: str = "fallback_fixed",
        default_intensity: float = 0,
    ) -> Model3D:
        """地震被害判定"""
        # 計算パラメータ(木造)
        caluculateparam_wood: Dict[str, List[float]] = {
            "no_data": {"lambda_complete": 6.514, "lambda_partial": 6.367, "devaiation_complete": 0.187, "devaiation_partial": 0.205},
            "under_1981": {"lambda_complete": 6.432, "lambda_partial": 6.343, "devaiation_complete": 0.133, "devaiation_partial": 0.157},
            "over_1981": {"lambda_complete": 6.659, "lambda_partial": 6.433, "devaiation_complete": 0.183, "devaiation_partial": 0.169},
        }

        # 計算パラメータ（非木造）
        caluculateparam_concrete: Dict[str, List[float]] = {
            "no_data": {"lambda_complete": 6.887, "lambda_partial": 6.493, "devaiation_complete": 0.319, "devaiation_partial": 0.184},
            "under_1981": {"lambda_complete": 6.768, "lambda_partial": 6.449, "devaiation_complete": 0.353, "devaiation_partial": 0.231},
            "over_1981": {"lambda_complete": 6.614, "lambda_partial": 6.51, "devaiation_complete": 0.063, "devaiation_partial": 0.175},
        }

        # BuildingDetail は dict 想定（schemas.py で Optional[dict]）
        building_detail = param.BuildingDetail if isinstance(param.BuildingDetail, dict) else None
        structure_type = None
        if building_detail is not None:
            structure_type = building_detail.get("buildingStructureType")

        # 計算不能フラグを一旦リセット（前回計算結果が残らないようにする）
        param.earthquake_uncomputable = False

        # strict: 必要情報が欠けている建物は「計算不能」として扱う（showは変更しない）
        if missing_data_policy == "strict":
            # 震度 + 建築年 + 構造種別が揃わない場合は計算しない
            if param.seismic_intensity is None or param.year is None or not structure_type:
                # フロント側で「計算不能」を判定できるようフラグを立てる
                param.earthquake_uncomputable = True
                # 震度は欠損状態に寄せる（既存仕様を維持）
                param.seismic_intensity = None
                return param

        # fallback_fixed: 欠損があっても固定値/デフォルトで補完して計算
        # 現仕様では「震度が欠損することはなく、取れない場合は 0」とするため、
        # ここでは None（本当に値が入っていないケース）のみを補完対象とする。
        if param.seismic_intensity is None:
            if missing_data_policy == "fallback_fixed":
                param.seismic_intensity = float(default_intensity)
            else:
                return param

        # 構造種別の決定（fallback時は未指定なら木造扱い）
        if not structure_type:
            structure_type = "wood"
        elif structure_type == 3:
            structure_type = "wood"
        else:
            structure_type = "concrete"
        
        architecturalPeriod = param.year
        if param.year is None:
            architecturalPeriod = "no_data"
        else:
            if param.year <= 1981:
                architecturalPeriod = "under_1981"
            else:
                architecturalPeriod = "over_1981"

        earthquake_intensity = param.seismic_intensity
        # 震度 0 は「被害無し」として扱い、対数計算を避けるためそのまま返す。
        if earthquake_intensity is None or earthquake_intensity <= 0:
            return param

        if structure_type == "wood":
            caluculateparam = caluculateparam_wood
        else:
            caluculateparam = caluculateparam_concrete
        
        

        damage_rate = norm.cdf((earthquake_intensity - caluculateparam[architecturalPeriod]["lambda_complete"]) / caluculateparam[architecturalPeriod]["devaiation_complete"])
        if damage_rate > 0.5:
            param.show = False

        return param
    
    def _calculate_thunami_damage_assessment(
        self,
        param: Model3D,
        *,
        missing_data_policy: str = "fallback_fixed",
        default_depth: float = 1.0,
        default_floors: int = 1,
        default_area: float = 100.0,
        default_structure_type: int = 3,
        default_usage: int = 1,
    ) -> Model3D:
        """津波被害判定"""
        # 計算パラメータ（木造）
        caluculateparam_wood: Dict[str, List[float]] = {
            "section": [-3.444, -3.349],
            "floodDepth": [1.088, 1.603],
            "floors": [-0.6844, -0.5398],
            "area": [-0.003809, -0.001909],
            "structureType3": [0, 0],
            "architecturalPeriod1": [0, 0],
            "architecturalPeriod2": [-0.1208, -0.001909],
            "architecturalPeriod3": [0.3251, 0.05358],
            "architecturalPeriod4": [-0.0391, -0.2634],
            "architecturalPeriod5": [-0.2955, -0.6985],
            "architecturalPeriod6": [-0.6426, -1.054],
            "purpose1": [0, 0],
            "purpose2": [0.002743, 0.2321],
            "purpose3": [0.09565, 0.08084],
            "purpose4": [0.1265, 0.1915],
            "purpose5": [-0.1531, -0.1856],
            "purpose6": [-0.9844, -0.5882],
            "devaiation": [1.532, 2.072]
        }

        # 計算パラメータ（非木造）
        calculateparam_concrete: Dict[str, List[float]] = {
            "section": [-5.966, -3.406],
            "floodDepth": [0.4584, 0.7256],
            "floors": [-0.5606, -0.5351],
            "area": [-0.001065, -0.0004088],
            "structureType1": [0, 0],
            "structureType2": [1.76, 1.504],
            "structureType4": [2.268, 1.403],
            "architecturalPeriod1": [0, 0],
            "architecturalPeriod2": [0, 0],
            "architecturalPeriod3": [0, 0],
            "architecturalPeriod4": [0.0003355, 0.1627],
            "architecturalPeriod5": [0.003832, -0.009885],
            "architecturalPeriod6": [-0.4716, -0.5078],
            
            "purpose1": [0, 0],
            "purpose2": [-0.2879, -0.3954],
            "purpose3": [-0.175, -0.5347],
            "purpose4": [0.1698, -0.5778],
            "purpose5": [0.2988, -0.1339],
            "purpose6": [-0.4998, -0.6209],
            "devaiation": [1.92, 1.605]
        }

        judgementparam = 1

        building_detail = param.BuildingDetail if isinstance(param.BuildingDetail, dict) else None
        floodDepth = param.thunami_inundation_depth
        floors = building_detail.get("storeysAboveGround") if building_detail else None
        area = building_detail.get("buildingArea") if building_detail else None
        structureType = building_detail.get("buildingStructureType") if building_detail else None
        purpose = building_detail.get("buildingUsage") if building_detail else None
        architecturalPeriod = param.year if param.year else None # 現状ロジック踏襲（必要なら将来年次から推定）

        # 計算不能フラグを一旦リセット（前回計算結果が残らないようにする）
        param.thunami_uncomputable = False

        if missing_data_policy == "strict":
            # 浸水深 + 建物詳細（階数/面積/構造/用途）が揃わない場合は計算しない
            if (
                floodDepth is None
                or floors is None
                or area is None
                or not structureType
                or purpose is None
            ):
                # フロント側で「計算不能」を判定できるようフラグを立てる
                param.thunami_uncomputable = True
                param.thunami_inundation_depth = None
                return param
        else:
            # fallback_fixed: 欠損があれば固定値で補完
            if floodDepth is None:
                floodDepth = float(default_depth)
                param.thunami_inundation_depth = float(default_depth)
            floors = int(floors) if floors is not None else int(default_floors)
            area = float(area) if area is not None else float(default_area)
            structureType = int(structureType) if structureType else int(default_structure_type)
            purpose = int(purpose) if purpose is not None else int(default_usage)

        # structureType は wood / concrete の2択に寄せる（それ以外は wood 扱い）
        if structureType == 3:
            calculateparam = caluculateparam_wood
        else:
            calculateparam = calculateparam_concrete

        if architecturalPeriod is None:
            if structureType == 3:
                architecturalPeriod = building_detail.get("architecturalPeriod")
            else:
                architecturalPeriod = building_detail.get("architecturalPeriod") + 2
        elif architecturalPeriod < 1952:
            architecturalPeriod = 1
        elif architecturalPeriod < 1962:
            architecturalPeriod = 2
        elif architecturalPeriod < 1972:
            architecturalPeriod = 3
        elif architecturalPeriod < 1982:
            architecturalPeriod = 4
        elif architecturalPeriod < 2001:
            architecturalPeriod = 5
        else:
            architecturalPeriod = 6
        
        # 念のため数値化（strict時は既に揃っている前提）
        if floodDepth is None:
            return param
        try:
            floodDepth_f = float(floodDepth)
        except (TypeError, ValueError):
            param.thunami_inundation_depth = None if missing_data_policy == "strict" else float(default_depth)
            return param

        damageRate = 1/(1+math.exp( -(calculateparam["section"][judgementparam] + calculateparam["floodDepth"][judgementparam] * floodDepth_f + calculateparam["floors"][judgementparam] * floors + calculateparam["area"][judgementparam] * area + calculateparam[f"structureType{structureType}"][judgementparam] + calculateparam[f"architecturalPeriod{architecturalPeriod}"][judgementparam]  + calculateparam[f"purpose{purpose}"][judgementparam] )))

        if damageRate > 0.5:
            param.show = False


        return param
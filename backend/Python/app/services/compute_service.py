import time
from datetime import datetime
from typing import Dict, Any, List, Optional, Literal
import math
import random
import numpy as np
from scipy.stats import norm, truncnorm
from ..models.schemas import ComputeRequest, ComputeResponse, Model3D, selectedRange, BuildingPopulationRequest
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
        result, total_victims = self._execute_computation(
            request.method,
            request.params,
            request.appStateYear,
            request.selectedRanges or [],
            missing_data_policy=missing_data_policy,
        )
        
        # キャッシュに保存（有効時のみ）
        if self.enable_cache:
            self.cache[cache_key] = result
        
        duration_ms = (time.time() - start_time) * 1000

        total_victims_int = int(round(float(total_victims)))

        return ComputeResponse(
            result=result,
            total_victims=total_victims_int,
            duration_ms=duration_ms,
            timestamp=datetime.now()
        )
    
    def _execute_computation(
        self,
        method: str,
        params: List[Model3D],
        appStateYear: int,
        selectedRanges: List[selectedRange],
        *,
        missing_data_policy: str = "fallback_fixed",
    ) -> tuple[List[Model3D], float]:
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
        victim_count = 0

        visivle_building_count = 0
        invisible_building_count = 0
        for param in params:
            if param.show == True:
                visivle_building_count += 1
            else:
                invisible_building_count += 1
        
        building_count = {"visible": visivle_building_count, "invisible": invisible_building_count}

        # 範囲フラグを整形化
        id_dict = {}
        for range in selectedRanges:
            if range.period["end"] <= appStateYear - 5:
                continue
            order = range.order
            for id in range.models:
                id_dict[id] = order

        for param in params:
            if method == "building_retention_rate":
                order = id_dict.get(param.id)
                result, num = self._calculate_building_retention_rate(param, appStateYear, building_Num, generated_building_count, order, building_count)
                new_building_Num += num
            elif method == "earthquake_damage_assessment":
                if param.show == True:
                    result, victim_num = self._calculate_earthquake_damage_assessment(param, missing_data_policy=missing_data_policy)
                    victim_count += victim_num
                else:
                    result = param
                
            elif method == "tsunami_damage_assessment":
                if param.show == True:
                    result, victim_num = self._calculate_tsunami_damage_assessment(param, missing_data_policy=missing_data_policy)
                    victim_count += victim_num
                else:
                    result = param

            results.append(result)
            
        print("増えた建物数", new_building_Num)
        print("被災者", victim_count)
        return results, victim_count
    
    def _calculate_building_retention_rate(self, param: Model3D, appStateYear: int, building_Num: int, generated_building_count: int, order: Optional[int], building_count: Dict[str, int]) -> Model3D:
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

        # 復活建物数のカウント用
        num = 0

        # 範囲設定による処理
        if order == 1:
            if appStateYear - param.year > 50 and random.random() > 0.5:
                param.year = appStateYear
            return param, num

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
        revival_probability = calculateparam_age[building_AgeType][1] * (building_count["visible"] / building_count["invisible"]) 


        # 特定範囲数からランダムで復活
        # revival_probability = generated_building_count / building_Num

        judgement = random.random()
        
        if param.show == True:
            if judgement < lost_probability:
                param.show = False
        else:
            if judgement < revival_probability:
                param.show = True
                param.isDamage = False
                param.year = appStateYear
                num = 1
        return param, num

    
    @staticmethod
    def _resolve_earthquake_damage_structure_kind(structure_type: Any) -> Literal["wood", "non_wood"]:
        """建物構造から地震被害計算に用いる区分を返す（木造／非木造）。"""
        if not structure_type:
            return "wood"
        if structure_type == 3:
            return "wood"
        return "non_wood"

    def _pick_earthquake_damage_assessment_fn(self, kind: Literal["wood", "non_wood"]):
        """区分に応じた地震被害計算関数を返す。"""
        if kind == "wood":
            return self._calculate_earthquake_damage_assessment_wood
        return self._calculate_earthquake_damage_assessment_non_wood

    def _calculate_earthquake_damage_assessment_non_wood(
        self,
        param: Model3D,
        architectural_period: str,
        earthquake_intensity: float,
        *,
        missing_data_policy: str = "fallback_fixed",
    ) -> tuple[Model3D, float]:
        """非木造建物向け地震被害判定（従来の非木造パラメータによる判定）。"""
        _ = missing_data_policy
        # 木造用パラメータ（非木造の計算式では使わないが、木造側実装の参照用として従来値を残す）
        caluculateparam_wood: Dict[str, Dict[str, float]] = {
            "no_data": {"lambda_complete": 6.514, "lambda_partial": 6.367, "devaiation_complete": 0.187, "devaiation_partial": 0.205},
            "under_1950": {"lambda_complete": 6.432, "lambda_partial": 6.343, "devaiation_complete": 0.133, "devaiation_partial": 0.157},
            "1951_1960": {"lambda_complete": 6.432, "lambda_partial": 6.343, "devaiation_complete": 0.133, "devaiation_partial": 0.157},
            "1961_1970": {"lambda_complete": 6.432, "lambda_partial": 6.343, "devaiation_complete": 0.133, "devaiation_partial": 0.157},
            "1971_1980": {"lambda_complete": 6.432, "lambda_partial": 6.343, "devaiation_complete": 0.133, "devaiation_partial": 0.157},
            "1981_1990": {"lambda_complete": 6.659, "lambda_partial": 6.433, "devaiation_complete": 0.183, "devaiation_partial": 0.169},
            "1991_2000": {"lambda_complete": 6.659, "lambda_partial": 6.433, "devaiation_complete": 0.183, "devaiation_partial": 0.169},
            "over_2001": {"lambda_complete": 6.659, "lambda_partial": 6.433, "devaiation_complete": 0.183, "devaiation_partial": 0.169},
        }
        caluculateparam_concrete: Dict[str, Dict[str, float]] = {
            "no_data": {"lambda_complete": 6.887, "lambda_partial": 6.493, "devaiation_complete": 0.319, "devaiation_partial": 0.184},
            "under_1950": {"lambda_complete": 6.768, "lambda_partial": 6.449, "devaiation_complete": 0.353, "devaiation_partial": 0.231},
            "1951_1960": {"lambda_complete": 6.768, "lambda_partial": 6.449, "devaiation_complete": 0.353, "devaiation_partial": 0.231},
            "1961_1970": {"lambda_complete": 6.768, "lambda_partial": 6.449, "devaiation_complete": 0.353, "devaiation_partial": 0.231},
            "1971_1980": {"lambda_complete": 6.768, "lambda_partial": 6.449, "devaiation_complete": 0.353, "devaiation_partial": 0.231},
            "1981_1990": {"lambda_complete": 6.614, "lambda_partial": 6.51, "devaiation_complete": 0.063, "devaiation_partial": 0.175},
            "1991_2000": {"lambda_complete": 6.614, "lambda_partial": 6.51, "devaiation_complete": 0.063, "devaiation_partial": 0.175},
            "over_2001": {"lambda_complete": 6.614, "lambda_partial": 6.51, "devaiation_complete": 0.063, "devaiation_partial": 0.175},
        }
        caluculateparam = caluculateparam_concrete
        damage_rate = norm.cdf(
            (earthquake_intensity - caluculateparam[architectural_period]["lambda_complete"])
            / caluculateparam[architectural_period]["devaiation_complete"]
        )
        if damage_rate > 0.5:
            param.show = False
            param.isDamage = True

        detail = param.buildingDetail
        people_num = detail.buildingPopulation if detail and detail.buildingPopulation is not None else 0
        victim_num = people_num * damage_rate * 0.177

        return param, victim_num

    # ======================
    # 木造の地震被害推定式
    # ======================

    def _calculate_earthquake_damage_assessment_wood(self, param: Model3D, architectural_period: str, earthquake_intensity: float, missing_data_policy: str = "fallback_fixed"):
        """木造建物向け地震被害判定"""
        # パラメータ一覧

        # 耐震評点推定
        PARAM_RESISTANCE_RATE: Dict[float, Dict[str, float]] = {
            0.1: {'a': -10.05, 'b': 16.61, 'c': 0.07},
            0.2: {'a': -11.05, 'b': 17.84, 'c': 0.06},
            0.3: {'a': -12.96, 'b': 19.89, 'c': 0.05},
            0.4: {'a': -16.01, 'b': 23.05, 'c': 0.04},
            0.5: {'a': -21.50, 'b': 28.64, 'c': 0.03},
            0.6: {'a': -32.96, 'b': 40.19, 'c': 0.02},
            0.7: {'a': -31.68, 'b': 39.00, 'c': 0.02},
            0.8: {'a': -1.32,  'b': 8.73,  'c': 0.08},
            0.9: {'a': -27.43, 'b': 35.00, 'c': 0.02},
        }

        # 被害率計算
        PARAM_DAMAGE_RATE: Dict[str, Dict[str, float]] = {
            "no_data": {"mean": -0.519, "std": 0.504},
            "under_1950": {"mean": -0.942, "std": 0.544 },
            "1951_1960": {"mean": -0.72, "std": 0.572},
            "1961_1970": {"mean": -0.519, "std": 0.504},
            "1971_1980": {"mean": -0.277, "std": 0.403},
            "1981_1990": {"mean": 0.001, "std": 0.376},
            "1991_2000": {"mean": 0.209, "std": 0.391},
            "over_2001": {"mean": 0.605, "std": 0.41}
        }

        # 被害状況別内部空間被災度
        PARAM_W = {
            6: 0.08,
            7: 0.08,
            8: 0.08,
            9: 0.6011,
            10: 0.9756
        }

        PARAM_NORM = {
            6: {'mean': -3.047, 'std': 0.6146, 'alpha': 0.9737},
            7: {'mean': -3.047, 'std': 0.6146, 'alpha': 0.9737},
            8: {'mean': -3.047, 'std': 0.6146, 'alpha': 0.9737},
            9: {'mean': -2.421, 'std': 0.4602, 'alpha': 0.9651},
            10: {'mean': -2.2698, 'std': 0.6233, 'alpha': 0.9188}
        }

        # 各損傷度xを受ける確率

        cap = PARAM_DAMAGE_RATE[architectural_period] 

        mu, sigma = cap['mean'], cap['std']

        damage_rate = {}

        for x in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]:

            s_val = ((earthquake_intensity - PARAM_RESISTANCE_RATE[x]['a']) / PARAM_RESISTANCE_RATE[x]['b'])**(1/PARAM_RESISTANCE_RATE[x]['c'])

            damage_rate[int(x * 10)] = norm.cdf(np.log(s_val), loc = mu, scale = sigma)
        
        # 被害判定
        if damage_rate[6] > 0.5:
            param.show = False
            param.isDamage = True
        
        #各損傷度区間別の損失空間内人口の計算

        damage_rate_delta = {}
        target_people = {}
        inside_people = {}
        victim_num = 0

        for x in [7, 8, 9, 10]:

            if x == 10:
                damage_rate_delta[x] = damage_rate[x - 1]
            else:
                damage_rate_delta[x] = damage_rate[x-1] - damage_rate[x]

            detail = param.buildingDetail
            people_num = detail.buildingPopulation if detail and detail.buildingPopulation is not None else 0
            target_people[x] = people_num * damage_rate_delta[x]
            inside_people[x] = target_people[x] * PARAM_W[x]
            victim_num += inside_people[x]
        
        return param, victim_num



    def _calculate_earthquake_damage_assessment(
        self,
        param: Model3D,
        *,
        missing_data_policy: str = "fallback_fixed",
        default_intensity: float = 0,
    ) -> tuple[Model3D, float]:
        """地震被害判定。構造種別に応じて木造用／非木造用の関数へ振り分ける。"""
        detail = param.buildingDetail
        structure_type = detail.buildingStructureType if detail else None

        # 計算不能フラグを一旦リセット（前回計算結果が残らないようにする）
        param.earthquake_uncomputable = False

        # strict: 必要情報が欠けている建物は「計算不能」として扱う（showは変更しない）
        if missing_data_policy == "strict":
            # 震度 + 建築年 + 構造種別が揃わない場合は計算しない
            if param.seismic_intensity is None or param.year is None or structure_type is None:
                # フロント側で「計算不能」を判定できるようフラグを立てる
                param.earthquake_uncomputable = True
                # 震度は欠損状態に寄せる（既存仕様を維持）
                param.seismic_intensity = None
                return param, 0.0

        # fallback_fixed: 欠損があっても固定値/デフォルトで補完して計算
        # 現仕様では「震度が欠損することはなく、取れない場合は 0」とするため、
        # ここでは None（本当に値が入っていないケース）のみを補完対象とする。
        if param.seismic_intensity is None:
            if missing_data_policy == "fallback_fixed":
                param.seismic_intensity = float(default_intensity)
            else:
                return param, 0.0

        kind = self._resolve_earthquake_damage_structure_kind(structure_type)

        if param.year is None:
            architectural_period = "no_data"
        else:
            if param.year <= 1950:
                architectural_period = "under_1950"
            elif param.year <= 1960:
                architectural_period = "1951_1960"
            elif param.year <= 1970:
                architectural_period = "1961_1970"
            elif param.year <= 1980:
                architectural_period = "1971_1980"
            elif param.year <= 1990:
                architectural_period = "1981_1990"
            elif param.year <= 2000:
                architectural_period = "1991_2000"
            else:
                architectural_period = "over_2001"

        earthquake_intensity = param.seismic_intensity
        # 震度 0 は「被害無し」として扱い、対数計算を避けるためそのまま返す。
        if earthquake_intensity is None or earthquake_intensity <= 0:
            return param, 0.0

        calculator = self._pick_earthquake_damage_assessment_fn(kind)
        return calculator(
            param,
            architectural_period,
            float(earthquake_intensity),
            missing_data_policy=missing_data_policy,
        )
    
    def _calculate_tsunami_damage_assessment(
        self,
        param: Model3D,
        *,
        missing_data_policy: str = "fallback_fixed",
        default_depth: float = 1.0,
        default_floors: int = 1,
        default_area: float = 100.0,
        default_structure_type: int = 3,
        default_usage: int = 1,
    ) -> tuple[Model3D, float]:
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

        detail = param.buildingDetail
        floodDepth = param.tsunami_inundation_depth
        floors = detail.storeysAboveGround if detail else None
        area = detail.buildingArea if detail else None
        structureType = detail.buildingStructureType if detail else None
        purpose = detail.buildingUsage if detail else None
        architecturalPeriod = param.year if param.year else None # 現状ロジック踏襲（必要なら将来年次から推定）

        # 計算不能フラグを一旦リセット（前回計算結果が残らないようにする）
        param.tsunami_uncomputable = False

        if missing_data_policy == "strict":
            # 浸水深 + 建物詳細（階数/面積/構造/用途）が揃わない場合は計算しない
            if (
                floodDepth is None
                or floors is None
                or area is None
                or structureType is None
                or purpose is None
            ):
                # フロント側で「計算不能」を判定できるようフラグを立てる
                param.tsunami_uncomputable = True
                param.tsunami_inundation_depth = None
                return param, 0.0
        else:
            # fallback_fixed: 欠損があれば固定値で補完
            if floodDepth is None:
                floodDepth = float(default_depth)
                param.tsunami_inundation_depth = float(default_depth)
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
                architecturalPeriod = detail.architecturalPeriod if detail else None
            else:
                architecturalPeriod = (detail.architecturalPeriod if detail and detail.architecturalPeriod is not None else 0) + 2
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
            return param, 0.0
        try:
            floodDepth_f = float(floodDepth)
        except (TypeError, ValueError):
            param.tsunami_inundation_depth = None if missing_data_policy == "strict" else float(default_depth)
            return param, 0.0

        damageRate = 1/(1+math.exp( -(calculateparam["section"][judgementparam] + calculateparam["floodDepth"][judgementparam] * floodDepth_f + calculateparam["floors"][judgementparam] * floors + calculateparam["area"][judgementparam] * area + calculateparam[f"structureType{structureType}"][judgementparam] + calculateparam[f"architecturalPeriod{architecturalPeriod}"][judgementparam]  + calculateparam[f"purpose{purpose}"][judgementparam] )))
        if damageRate > 0.5:
            param.show = False
            param.isDamage = True

        # 津波による人的被害は別手法で実装予定のため、ここでは合計に加算しない
        return param, 0.0

    def building_population(self, request: BuildingPopulationRequest) -> ComputeResponse:
        """計算リクエストを処理"""
        start_time = time.time()
        
        # 実際の計算
        result = self._calculate_building_population(
            request.params,
            request.appStateYear,
            request.selectedRanges or [],
            request.population,
        )
        
        duration_ms = (time.time() - start_time) * 1000

        return ComputeResponse(
            result=result,
            duration_ms=duration_ms,
            timestamp=datetime.now()
        )

    from typing import List

    def _calculate_building_population(self, params: List[Model3D], appStateYear: int, selectedRanges: List[selectedRange], population: dict) -> List[Model3D]:
    
        for target_mesh in population.values():
            target_population = target_mesh[str(appStateYear)]

            active_buildings = []
            total_area = 0

            for building_id in target_mesh["buildings"]:
                idx = int(building_id) - 1
            
                if idx < 0 or idx >= len(params):
                    print(f"建物ID {building_id} に対応する要素が params にありません")
                    continue
                
                building = params[idx]

                if building is None:
                    print("建物ない")
                    continue

                if building.show:

                    if building.buildingDetail is None:
                        print(f"建物ID {building_id} は buildingDetail が空のためスキップします")
                        continue
                    active_buildings.append(building)
                    total_area += building.buildingDetail.buildingArea
            
            if total_area == 0:
                continue
            for target_building in active_buildings:
                target_building.buildingDetail.buildingPopulation = int(target_population["total"] * (target_building.buildingDetail.buildingArea / total_area))
        return params
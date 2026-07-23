from app.services.compute_service import ComputeService
from app.models.schemas import ComputeRequest, AnalysisResponse

class AnalysisService:
    def __init__(self):
        self.cache = {}  # 簡単なメモリキャッシュ
        self.enable_cache = False  # 開発中はキャッシュ無効
        self.compute_service = ComputeService()  # インスタンス作成

    def analyze(self, request: ComputeRequest):
        target_params = request.params
        first_count = [0, 0, 0, 0, 0, 0, 0]
        for param in target_params:
            if param.show == True:
                first_count[0] += 1
                building_age =request.appStateYear - param.year
                if building_age < 6:
                    first_count[1] += 1
                elif building_age < 16:
                    first_count[2] += 1
                elif building_age < 26:
                    first_count[3] += 1
                elif building_age < 36:
                    first_count[4] += 1
                elif building_age < 46:
                    first_count[5] += 1
                elif building_age >= 46:
                        first_count[6] += 1
        results = [first_count]
        for i in range(5):
            result = self.compute_service.compute(ComputeRequest(method=request.method, appStateYear=request.appStateYear + 5*(i+1), disasterState=request.disasterState, selectedRanges=request.selectedRanges, params=target_params))
            target_params = result.result  # 次の年は前の年の結果を使用
            count = [0, 0, 0, 0, 0, 0, 0]
            for param in target_params:
                if param.show == True:
                    count[0] += 1
                    building_age = request.appStateYear + 5*(i+1) - param.year
                    if building_age < 6:
                        count[1] += 1
                    elif building_age < 16:
                        count[2] += 1
                    elif building_age < 26:
                        count[3] += 1
                    elif building_age < 36:
                        count[4] += 1
                    elif building_age < 46:
                        count[5] += 1
                    elif building_age >= 46:
                        count[6] += 1
                    
            results.append(count)
        return results
        
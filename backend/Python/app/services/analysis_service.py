from app.services.compute_service import ComputeService
from app.models.schemas import ComputeRequest, AnalysisResponse

class AnalysisService:
    def __init__(self):
        self.cache = {}  # 簡単なメモリキャッシュ
        self.enable_cache = False  # 開発中はキャッシュ無効
        self.compute_service = ComputeService()  # インスタンス作成

    def analyze(self, request: ComputeRequest):
        target_params = request.params
        first_count = 0
        for param in target_params:
            if param.show == True:
                first_count += 1
        results = []
        results.append(first_count)
        for i in range(5):
            result = self.compute_service.compute(ComputeRequest(method=request.method, appStateYear=request.appStateYear + 5*i, params=target_params))
            target_params = result.result  # 次の年は前の年の結果を使用
            count = 0
            for param in target_params:
                if param.show == True:
                    count += 1
            results.append(count)
        return results
        
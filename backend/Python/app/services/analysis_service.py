

class AnalysisService:
    def __init__(self):
        self.cache = {}  # 簡単なメモリキャッシュ
        self.enable_cache = False  # 開発中はキャッシュ無効

    def analyze(self, request: AnalysisRequest) -> AnalysisResponse:
        
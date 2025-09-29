import os
from typing import List, Optional
from ..core.config import settings
from ..models.schemas import Model3D, ModelSearchQuery

class DataService:
    def __init__(self):
        self.models_cache = None
        self.cache_timestamp = None
    
    def _load_models(self) -> List[Model3D]:
        """JSONファイルからモデルデータを読み込み"""
        if self.models_cache and self.cache_timestamp:
            # キャッシュが有効な場合はそれを使用
            return self.models_cache
        
        file_path = os.path.join(settings.data_dir, settings.models_file)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.models_cache = [Model3D(**item) for item in data]
            self.cache_timestamp = os.path.getmtime(file_path)
            return self.models_cache
        except FileNotFoundError:
            return []
    
    def get_models(self, query: ModelSearchQuery) -> List[Model3D]:
        """検索条件に基づいてモデルを取得"""
        models = self._load_models()
        
        # フィルタリング
        filtered = models
        
        if query.min_lat is not None:
            filtered = [m for m in filtered if m.latitude >= query.min_lat]
        if query.max_lat is not None:
            filtered = [m for m in filtered if m.latitude <= query.max_lat]
        if query.min_lon is not None:
            filtered = [m for m in filtered if m.longitude >= query.min_lon]
        if query.max_lon is not None:
            filtered = [m for m in filtered if m.longitude <= query.max_lon]
        if query.year_from is not None:
            filtered = [m for m in filtered if m.year_built and m.year_built >= query.year_from]
        if query.year_to is not None:
            filtered = [m for m in filtered if m.year_built and m.year_built <= query.year_to]
        
        return filtered[:query.limit]
    
    def get_model_by_id(self, model_id: int) -> Optional[Model3D]:
        """IDでモデルを取得"""
        models = self._load_models()
        return next((m for m in models if m.id == model_id), None)
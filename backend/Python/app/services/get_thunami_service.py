import math
from app.models.schemas import Model3D
from app.services.thunami_data_servicw import ThunamiDataService
from typing import List

class GetThunamiService:
    def __init__(self):
        self.thunami_data_service = ThunamiDataService()
        self.thunami_data_service.ensure_loaded_from_directory()
    
    def get_depth(self, latitude: float, longitude: float) -> float:
        if self.tree is None:
            return 0.0
        
        

    
    def get_thunami_data(self, buildings: List[Model3D]) -> List[Model3D]:
        """
        各建物に津波浸水深を付与する。

        現仕様では「浸水深が欠損することはなく、取得できない場合は 0 とする」
        という前提のため、ここでは欠損を 0.0 に正規化する。
        （missing_data_policy は後方互換のために残している）
        """
        return self.get_thunami_data_with_policy(buildings)

    def get_thunami_data_with_policy(
        self,
        buildings: List[Model3D],
        *,
        missing_data_policy: str = "fallback_fixed",
        default_depth: float = 1.0,
    ) -> List[Model3D]:
        """
        津波浸水深を各建物に付与する。

        - データが取得できない場合は 0.0 を設定する
        - これにより下流の計算では None を前提とせず、0 を「浸水無し」として扱える
        """
        for building in buildings:
            if building.show is False:
                continue

            latitude = building.latitude
            longitude = building.longitude
            if latitude is None or longitude is None:
                building.thunami_inundation_depth = 0.0
                continue

            inundation_depth = self.thunami_data_service.get_inundation_depth(latitude, longitude)
            if inundation_depth is None:
                building.thunami_inundation_depth = 0.0
            else:
                building.thunami_inundation_depth = float(inundation_depth)

        return buildings
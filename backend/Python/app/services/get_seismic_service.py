import math
from app.models.schemas import Model3D
from app.services.seismic_data_service import SeismicDataService
from typing import List



class GetSeismicService:
    def __init__(self):
        self.seismic_data_service = SeismicDataService()
        self.seismic_data_service.ensure_loaded_from_directory()

    # メッシュコード取得(日本測地系)
    def _get_1stmeshCode(self, latitude: float, longitude: float) -> int:

        mesh1st = int(latitude * 1.5) * 100 + int(longitude - 100)
        return mesh1st
    
    def _get_2ndmeshCode(self, latitude: float, longitude: float) -> int:
        mesh1st = self._get_1stmeshCode(latitude, longitude)
        mesh2nd = int(math.floor(latitude * 12 % 8)) * 10 + int(math.floor((longitude - 100) * 8) % 8)
        return mesh1st * 100 + mesh2nd
    
    def _get_3rdmeshCode(self, latitude: float, longitude: float) -> int:
        mesh2nd = self._get_2ndmeshCode(latitude, longitude)
        mesh3rd = int(math.floor(latitude * 120 % 10)) * 10 + int(math.floor((longitude - 100) * 80)) % 10
        return mesh2nd * 100 + mesh3rd
    
    def _get_4thmeshCode(self, latitude: float, longitude: float) -> int:
        mesh3rd = self._get_3rdmeshCode(latitude, longitude)
        mesh4th = int(math.floor(latitude * 240)) % 2 * 2 + int(math.floor((longitude - 100) * 160)) % 2 + 1
        return mesh3rd * 10 + mesh4th

    def _get_5thmeshCode(self, latitude: float, longitude: float) -> int:
        mesh4th = self._get_4thmeshCode(latitude, longitude)
        mesh5th = int(math.floor(latitude * 480)) % 2 * 2 + int(math.floor((longitude - 100) * 320)) % 2 + 1
        return mesh4th * 10 + mesh5th
    
    def get_meshCode(self, building: Model3D) -> int:
        latitude = building.latitude
        longitude = building.longitude
        meshCode = self._get_5thmeshCode(latitude, longitude)
        return meshCode
    
    def get_seismic_data(self, buildings: List[Model3D]) -> List[Model3D]:
        """
        各建物に震度(SI)を付与する。

        現仕様では「震度が欠損することはなく、取得できない場合は 0 とする」
        という前提のため、ここでは欠損を 0.0 に正規化する。
        （missing_data_policy は後方互換のために残している）
        """
        return self.get_seismic_data_with_policy(buildings)

    def get_seismic_data_with_policy(
        self,
        buildings: List[Model3D],
        *,
        missing_data_policy: str = "fallback_fixed",
        default_intensity: float = 600.0,
    ) -> List[Model3D]:
        """
        震度を各建物に付与する。

        - データが取得できない場合は 0.0 を設定する
        - これにより下流の計算では None を前提とせず、0 を「揺れ無し」として扱える
        """
        for building in buildings:
            if building.show is False:
                continue

            # 位置情報が欠けている場合はメッシュコードが引けないが、
            # 現仕様では「欠けることはなく、なければ 0」という前提に合わせて 0.0 を設定する。
            if building.latitude is None or building.longitude is None:
                building.seismic_intensity = 0.0
                continue

            meshCode = self.get_meshCode(building)
            intensity = self.seismic_data_service.get_intensity(meshCode, default=None)
            if intensity is None:
                # 近傍にデータが無い場合も 0.0 として扱う
                building.seismic_intensity = 0.0
            else:
                building.seismic_intensity = float(intensity)

        return buildings
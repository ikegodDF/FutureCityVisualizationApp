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
        for building in buildings:
            if building.show == False:
                continue
            
            meshCode = self.get_meshCode(building)
            intensity = self.seismic_data_service.get_intensity(meshCode)
            building.seismic_intensity = intensity if intensity is not None else 0.0
        return buildings
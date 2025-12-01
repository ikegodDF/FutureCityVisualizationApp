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
        for building in buildings:
            if building.show == False:
                continue

            latitude = building.latitude
            longitude = building.longitude
            inundation_depth = self.thunami_data_service.get_inundation_depth(latitude, longitude)
            building.thunami_inundation_depth = inundation_depth if inundation_depth is not None else 0.0
            print(building.name, building.thunami_inundation_depth)
        return buildings
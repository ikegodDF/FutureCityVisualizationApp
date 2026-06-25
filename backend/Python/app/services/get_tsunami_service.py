from typing import List

from app.models.schemas import Model3D
from app.services.region_data_manager import region_data_manager


class GetTsunamiService:
    def get_tsunami_data(self, buildings: List[Model3D], *, region: str = "mukawa") -> List[Model3D]:
        return self.get_tsunami_data_with_policy(buildings, region=region)

    def get_tsunami_data_with_policy(
        self,
        buildings: List[Model3D],
        *,
        region: str = "mukawa",
        missing_data_policy: str = "fallback_fixed",
    ) -> List[Model3D]:
        tsunami_data_service = region_data_manager.get_tsunami_service(region)
        for building in buildings:
            if building.show is False:
                continue

            latitude = building.latitude
            longitude = building.longitude

            if latitude is None or longitude is None:
                building.tsunami_inundation_depth = 0.0
                building.tsunami_arrival_time = None

                continue

            inundation_depth = tsunami_data_service.get_inundation_depth(latitude, longitude)
            if inundation_depth is None:
                building.tsunami_inundation_depth = 0.0
            else:
                building.tsunami_inundation_depth = float(inundation_depth)
                print(building.name)
                print(building.tsunami_inundation_depth)

            arrival_time = tsunami_data_service.get_arrival_time(latitude, longitude)
            if arrival_time is None:
                building.tsunami_arrival_time = None
            else:
                building.tsunami_arrival_time = int(arrival_time)

        return buildings

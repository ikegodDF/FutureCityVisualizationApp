import os
from typing import Dict, Optional

from ..core.config import settings
from ..core.regions import get_default_region_id, get_region
from .seismic_data_service import SeismicDataService
from .tsunami_data_service import TsunamiDataService


class RegionDataManager:
    """地域ごとの震度・津波 CSV をキャッシュして提供する。"""

    def __init__(self):
        self._seismic_services: Dict[str, SeismicDataService] = {}
        self._tsunami_services: Dict[str, TsunamiDataService] = {}

    def get_seismic_service(self, region_id: Optional[str] = None) -> SeismicDataService:
        region_key = region_id or get_default_region_id()
        if region_key not in self._seismic_services:
            region = get_region(region_key)
            service = SeismicDataService()
            file_path = os.path.join(settings.data_dir, region["data"]["seismicFile"])
            service._load_from_path(file_path)
            self._seismic_services[region_key] = service
        return self._seismic_services[region_key]

    def get_tsunami_service(self, region_id: Optional[str] = None) -> TsunamiDataService:
        region_key = region_id or get_default_region_id()
        if region_key not in self._tsunami_services:
            region = get_region(region_key)
            service = TsunamiDataService()
            file_path = os.path.join(settings.data_dir, region["data"]["tsunamiFile"])
            service._load_from_path(file_path)
            self._tsunami_services[region_key] = service
        return self._tsunami_services[region_key]


region_data_manager = RegionDataManager()

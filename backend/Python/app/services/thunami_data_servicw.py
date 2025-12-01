import csv
import os
from io import TextIOBase
from typing import Optional, Union, Tuple, List

import numpy as np
from scipy.spatial import KDTree

from ..core.config import settings

class ThunamiDataService:
    def __init__(self):
        # (lat, lon) の点群と、それに対応する浸水深の配列
        self._points: List[Tuple[float, float]] = []
        self._depths: List[float] = []
        self._source_mtime: Optional[float] = None
        self.tree: Optional[KDTree] = None
        self.depth_values: List[float] = []

    def ensure_loaded_from_directory(self) -> None:
        file_path = os.path.join(settings.data_dir, settings.thunami_inundation_depth_file)
        self._load_from_path(file_path)

    def load_from_file(self, file_obj: Union[TextIOBase, bytes]) -> None:
        if isinstance(file_obj, bytes):
            text_stream = file_obj.decode("utf-8").splitlines()
        else:
            text_stream = file_obj
        reader = csv.DictReader(text_stream)
        self._points, self._depths = self._parse_rows(reader)
        self._source_mtime = None
        reader = csv.DictReader(text_stream)
        self._points, self._depths = self._parse_rows(reader)
        self._source_mtime = None
    

    def _load_from_path(self, file_path: str) -> None:
        if not os.path.exists(file_path):
            return
        current_mtime = os.path.getmtime(file_path)
        if self._source_mtime and self._source_mtime == current_mtime:
            return
        with open(file_path, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            self._points, self._depths = self._parse_rows(reader)
            self._source_mtime = current_mtime


    def get_inundation_depth(self, latitude: float, longitude: float) -> float:
        if self.tree is None:
            return 0.0

        dist, index = self.tree.query((latitude, longitude), k=1)
        limit_degree = 0.00015  # 約15m

        if dist > limit_degree:
            return 0.0

        return self.depth_values[index] if 0 <= index < len(self.depth_values) else 0.0

    def _parse_rows(self, reader: csv.DictReader) -> Tuple[List[Tuple[float, float]], List[float]]:
        """
        CSVのヘッダは以下を想定:
          - lat, lon, SIN_MAX
        lat/lon は10mメッシュ中心点、SIN_MAX は浸水深。
        """
        points: List[Tuple[float, float]] = []
        depths: List[float] = []
        for row in reader:
            latitude = row.get("lat")
            longitude = row.get("lon")
            inundation_depth_raw = row.get("SIN_SH01")
            if latitude is None or longitude is None or inundation_depth_raw is None:
                continue
            try:
                lat_val = float(latitude)
                lon_val = float(longitude)
                inundation_depth = float(inundation_depth_raw)
            except (ValueError, TypeError):
                continue
            points.append((lat_val, lon_val))
            depths.append(inundation_depth)
        
        if points:
            self.tree = KDTree(np.array(points))
            self.depth_values = depths
        else:
            self.tree = None
            self.depth_values = []

        return points, depths

    @staticmethod
    def _normalize_mesh_code(code: str) -> str:
        return code.strip().strip('"').strip("'")

import csv
import os
from io import TextIOBase
from typing import Optional, Union, Tuple, List

import numpy as np
from scipy.spatial import KDTree

from ..core.config import settings

class TsunamiDataService:
    def __init__(self):
        # (lat, lon) の点群と、それに対応する浸水深の配列
        self._points: List[Tuple[float, float]] = []
        self._depths: List[float] = []
        self._source_mtime: Optional[float] = None
        self.tree: Optional[KDTree] = None
        self.depth_values: List[float] = []
        self.time_values: List[int] = []

    def ensure_loaded_from_directory(self) -> None:
        file_path = os.path.join(settings.data_dir, settings.tsunami_inundation_depth_file)
        self._load_from_path(file_path)

    def load_from_file(self, file_obj: Union[TextIOBase, bytes]) -> None:
        if isinstance(file_obj, bytes):
            text_stream = file_obj.decode("utf-8").splitlines()
        else:
            text_stream = file_obj
        reader = csv.DictReader(text_stream)
        self._points, self._depths, _ = self._parse_rows(reader)
        self._source_mtime = None
    

    def _load_from_path(self, file_path: str) -> None:
        if not os.path.exists(file_path):
            return
        current_mtime = os.path.getmtime(file_path)
        if self._source_mtime and self._source_mtime == current_mtime:
            return
        with open(file_path, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            self._points, self._depths, _ = self._parse_rows(reader)
            self._source_mtime = current_mtime


    def get_inundation_depth(self, latitude: float, longitude: float) -> Optional[float]:
        """
        指定地点の浸水深を取得。
        - データが未ロード/近傍点が見つからない場合は None を返す（=欠損）
        - 近傍点が取得できた場合は浸水深(float)を返す
        """
        if self.tree is None:
            return None

        dist, index = self.tree.query((latitude, longitude), k=1)
        limit_degree = 0.00015  # 約15m

        if dist > limit_degree:
            return None

        if 0 <= index < len(self.depth_values):
            return float(self.depth_values[index])
        return None

    def get_arrival_time(self, latitude: float, longitude: float) -> Optional[int]:

        if self.tree is None:
            return None

        dist, index = self.tree.query((latitude, longitude), k=1)
        limit_degree = 0.00015

        if dist > limit_degree:
            return None
        
        if 0 <= index < len(self.time_values):
            return self.time_values[index]
        return None

    def _parse_rows(self, reader: csv.DictReader) -> Tuple[List[Tuple[float, float]], List[float], List[int]]:
        
        """
        CSVのヘッダは以下を想定:
          - lat, lon, SIN_MAX
        lat/lon は10mメッシュ中心点、SIN_MAX は浸水深。
        備考: -9999.0 は欠損値なのでスキップ
        """
        points: List[Tuple[float, float]] = []
        depths: List[float] = []
        times: List[int] = []
        for row in reader:
            latitude = row.get("lat")
            longitude = row.get("lon")
            inundation_depth_raw = row.get("SIN_SH01")
            arrival_time_raw = row.get("TIME_SH01")
            if latitude is None or longitude is None or inundation_depth_raw is None or arrival_time_raw is None:
                continue
            try:
                lat_val = float(latitude)
                lon_val = float(longitude)
                inundation_depth = float(inundation_depth_raw)
                arrival_time = int(float(arrival_time_raw))
            except (ValueError, TypeError):
                continue
            # -9999 は欠損値なのでスキップ
            if inundation_depth == -9999.0 or arrival_time == -9999:
                continue
            points.append((lat_val, lon_val))
            depths.append(inundation_depth)
            times.append(arrival_time)
        
        if points:
            self.tree = KDTree(np.array(points))
            self.depth_values = depths
            self.time_values = times
        else:
            self.tree = None
            self.depth_values = []
            self.time_values = []


        return points, depths, times

    def get_distribution(self) -> List[dict]:
        """
        フロントエンド配信用に、全地点の津波浸水深データを辞書の配列形式で一括取得する。
        出力形式: [{'latitude': xxx, 'longitude': yyy, 'depth': zzz}, ...]
        """
        if not self._points or not self._depths:
            return []

        # 緯度経度のペアリスト(_points)と、浸水深のリスト(_depths)を合流させて辞書配列を作る
        return [
            {
                "latitude": float(point[0]),
                "longitude": float(point[1]),
                "depth": float(depth)
            }
            for point, depth in zip(self._points, self._depths)
        ]

    @staticmethod
    def _normalize_mesh_code(code: str) -> str:
        return code.strip().strip('"').strip("'")

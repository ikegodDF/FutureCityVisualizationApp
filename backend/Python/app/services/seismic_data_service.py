import csv
import os
from io import TextIOBase
from typing import Dict, Optional, Union

from ..core.config import settings


class SeismicDataService:
    """
    震度CSVを読み込み、建物ID→震度のマップを提供するサービス。
    ディレクトリ常駐ファイルとユーザーアップロード双方に対応できるよう設計。
    """

    def __init__(self):
        self._intensity_map: Dict[int, float] = {}
        self._source_mtime: Optional[float] = None

    # Public API -------------------------------------------------------------
    def ensure_loaded_from_directory(self) -> None:
        """
        settings.data_dir 配下のデフォルトCSVを読み込みキャッシュする。
        既に同じ更新日時のデータを読み込み済みの場合はスキップする。
        """
        file_path = os.path.join(settings.data_dir, settings.seismic_intensity_file)
        self._load_from_path(file_path)

    def load_from_file(self, file_obj: Union[TextIOBase, bytes]) -> None:
        """
        ユーザーアップロードなど、任意のファイルオブジェクトから震度データを読み込む。
        読み込み後は内部マップを差し替え、ディレクトリキャッシュとは独立して扱う。
        """
        if isinstance(file_obj, bytes):
            text_stream = file_obj.decode("utf-8").splitlines()
        else:
            text_stream = file_obj

        reader = csv.DictReader(text_stream)
        self._intensity_map = self._parse_rows(reader)
        self._source_mtime = None  # カスタム入力のためmtimeは無効化

    def get_intensity(self, building_id: int, default: Optional[float] = None) -> Optional[float]:
        """
        建物IDに紐づく震度を取得。存在しない場合は default を返す。
        """
        return self._intensity_map.get(building_id, default)

    # Internal helpers -------------------------------------------------------
    def _load_from_path(self, file_path: str) -> None:
        if not os.path.exists(file_path):
            return

        current_mtime = os.path.getmtime(file_path)
        if self._source_mtime and self._source_mtime == current_mtime:
            return

        with open(file_path, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            self._intensity_map = self._parse_rows(reader)
            self._source_mtime = current_mtime

    @staticmethod
    def _parse_rows(reader: csv.DictReader) -> Dict[int, float]:
        """
        CSVのヘッダは以下のいずれかを想定:
          - id, intensity
          - building_id, intensity_value
        """
        map_data: Dict[int, float] = {}
        for row in reader:
            building_raw = (
                row.get("id")
                or row.get("building_id")
                or row.get("model_id")
            )
            intensity_raw = (
                row.get("intensity")
                or row.get("earthquake_intensity")
                or row.get("intensity_value")
            )

            if building_raw is None or intensity_raw is None:
                continue

            try:
                building_id = int(building_raw)
                intensity = float(intensity_raw)
            except (ValueError, TypeError):
                continue

            map_data[building_id] = intensity

        return map_data


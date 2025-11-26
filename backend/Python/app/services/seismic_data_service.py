import csv
import os
from io import TextIOBase
from typing import Dict, Optional, Union

from ..core.config import settings


class SeismicDataService:
    """
    震度CSVを読み込み、メッシュコード→震度のマップを提供するサービス。
    ディレクトリ常駐ファイルとユーザーアップロード双方に対応できるよう設計。
    """

    def __init__(self):
        self._mesh_intensity_map: Dict[str, float] = {}
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
        self._mesh_intensity_map = self._parse_rows(reader)
        self._source_mtime = None  # カスタム入力のためmtimeは無効化

    def get_intensity(self, mesh_code: Union[str, int], default: Optional[float] = None) -> Optional[float]:
        """
        メッシュコードに対応する震度(SI)を取得。
        """
        if mesh_code is None:
            return default

        normalized_code = self._normalize_mesh_code(mesh_code)
        return self._mesh_intensity_map.get(normalized_code, default)

    def load_mesh_intensity(self, path: str):
        """
        デバッグ/ユーティリティ用途: 指定パスのCSVを読み込み、{meshcode, SI} の配列で返す。
        """
        mesh_list = []

        with open(path, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                meshcode = (
                    row.get("meshcode")
                    or row.get("MESHCODE")
                    or row.get("CODE")
                )
                si_value = row.get("SI") or row.get("si")

                if not meshcode or not si_value:
                    continue  # 空値や欠損がある行はスキップ

                try:
                    intensity = float(si_value)
                except (ValueError, TypeError):
                    continue

                mesh_list.append(
                    {
                        "meshcode": self._normalize_mesh_code(meshcode),
                        "SI": intensity,
                    }
                )

        return mesh_list

    # Internal helpers -------------------------------------------------------
    def _load_from_path(self, file_path: str) -> None:
        if not os.path.exists(file_path):
            return

        current_mtime = os.path.getmtime(file_path)
        if self._source_mtime and self._source_mtime == current_mtime:
            return

        with open(file_path, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            self._mesh_intensity_map = self._parse_rows(reader)
            self._source_mtime = current_mtime

    def _parse_rows(self, reader: csv.DictReader) -> Dict[str, float]:
        """
        CSVのヘッダは以下のいずれかを想定:
          - meshcode, SI
          - CODE, SI (内閣府公表データ等)
        """
        mesh_map: Dict[str, float] = {}
        for row in reader:
            meshcode_raw = (
                row.get("meshcode")
                or row.get("MESHCODE")
                or row.get("CODE")
            )
            intensity_raw = row.get("SI") or row.get("si")

            if meshcode_raw is None or intensity_raw is None:
                continue

            meshcode = self._normalize_mesh_code(meshcode_raw)
            try:
                intensity = float(intensity_raw)
            except (ValueError, TypeError):
                continue

            mesh_map[meshcode] = intensity
        return mesh_map

    @staticmethod
    def _normalize_mesh_code(code: Union[str, int]) -> str:
        """
        CSVに含まれるメッシュコードを統一的な文字列に整形。
        ダブルクォート等が含まれていても取り除き、ゼロ埋め・桁落ちを防ぐ。
        """
        if isinstance(code, int):
            return str(code)

        cleaned = str(code).strip().strip('"').strip("'")
        return cleaned

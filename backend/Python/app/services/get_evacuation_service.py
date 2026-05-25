import csv
import os
from io import TextIOBase
from typing import Optional, Union, List, Dict, Any

from app.models.schemas import TsunamiEvacuationData, Model3D
from ..core.config import settings

class GetEvacuationService:
    def __init__(self):
        self._extended_attributes: List[Dict[str, Any]] = []
        self._source_mtime: Optional[float] = None

    def ensure_loaded_from_directory(self) -> None:
        filename = getattr(settings, "tsunami_evacuation_file", "tsunami/津波避難データ_豊浦.csv")
        file_path = os.path.join(settings.data_dir, filename)
        print(f"【EvacuationService】CSVファイルをロードします: {file_path}")
        self._load_from_path(file_path)

    def load_from_file(self, file_obj: Union[TextIOBase, bytes]) -> None:
        if isinstance(file_obj, bytes):
            text_stream = file_obj.decode("utf-8").splitlines()
        else:
            text_stream = file_obj
        reader = csv.DictReader(text_stream)
        self._extended_attributes = self._parse_rows(reader)
        self._source_mtime = None

    def _load_from_path(self, file_path: str) -> None:
        if not os.path.exists(file_path):
            print(f"【EvacuationService】❌ エラー: ファイルが見つかりません: {file_path}")
            return
        current_mtime = os.path.getmtime(file_path)
        if self._source_mtime and self._source_mtime == current_mtime:
            return
            
        with open(file_path, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            self._extended_attributes = self._parse_rows(reader)
            self._source_mtime = current_mtime

    def _parse_rows(self, reader: csv.DictReader) -> List[Dict[str, Any]]:
        extended_attributes: List[Dict[str, Any]] = []

        for row in reader:
            # 👑 文字列用ヘルパー：値が None や 空文字 "" の場合は "0" を返す
            def safe_str(key: str) -> str:
                val = row.get(key)
                return str(val).strip() if val and str(val).strip() != "" else "0"

            extended_attributes.append({
                "people": row.get("people") or row.get("建物内人口_総数") or None,
                # 👑 全てハイフンから "0" に変更
                "shelterName": safe_str("最寄避難先名称"),
                "evacDistance": safe_str("避難距離_m"),
                "inundationDepth": safe_str("浸水深_m"),
                "evacuationTime": safe_str("移動時間_高齢者_分"),
                "tsunamiTime": safe_str("津波到達時間_分"),
                "c3Deaths": safe_str("C3_死亡人口_総数"),
                "c3DeathRate": safe_str("C3_死亡率_総数"),
                "c4Deaths": safe_str("C4_死亡人口_総数"),
                "c4DeathRate": safe_str("C4_死亡率_総数")
            })
        print(f"【EvacuationService】✅ CSVから {len(extended_attributes)} 件のデータを正常にパースしました。")
        return extended_attributes

    def merge_evacuation_data_with_policy(self, params: List[Model3D], missing_data_policy: Optional[str] = None) -> List[Model3D]:
        if not self._extended_attributes:
            print("【EvacuationService】データが未ロードのため、ディレクトリから自動ロードを試みます。")
            self.ensure_loaded_from_directory()

        if not params or not self._extended_attributes:
            print("【EvacuationService】⚠️ 警告: マージに必要なデータが不足しています。")
            return params

        merge_count = min(len(params), len(self._extended_attributes))
        print(f"【EvacuationService】⚡ マージを開始します。建物数: {len(params)}, マージ対象数: {merge_count}")
        
        for i in range(merge_count):
            csv_attr = self._extended_attributes[i]
            building = params[i]

            if csv_attr["people"] is not None:
                try:
                    building.people = int(csv_attr["people"])
                except (ValueError, TypeError):
                    pass

            # Pydanticオブジェクトに詰め込む (各階層で "0" が保証されています)
            building.tsunami_data = TsunamiEvacuationData(
                shelterName=str(csv_attr["shelterName"]),
                evacDistance=str(csv_attr["evacDistance"]),
                inundationDepth=str(csv_attr["inundationDepth"]),
                evacuationTime=str(csv_attr["evacuationTime"]),
                tsunamiTime=str(csv_attr["tsunamiTime"]),
                c3Deaths=str(csv_attr["c3Deaths"]),
                c3DeathRate=str(csv_attr["c3DeathRate"]),
                c4Deaths=str(csv_attr["c4Deaths"]),
                c4DeathRate=str(csv_attr["c4DeathRate"])
            )
            
            # 👑 2. 【Boolean型用の追加ロジック】
            # フロントの JS 側で `renewModel.evacuation_data.late == true` のように判定しているため、
            # 初期値（デフォルト）としてすべて False をここでセットします。
            # (フロントのタイポ対策として、両方のキー名で初期化しておくと安全です)
            default_bool_data = {
                "early": False,
                "late": False,
                "emergence": False
            }
            building.evacuation_data = default_bool_data
            building.evacuation_data = default_bool_data # タイポ用お守り
            
        print(f"【EvacuationService】🎉 {merge_count} 件の建物へのデータマージ（str型: '0', bool型: False の初期化）が完了しました。")
        return params
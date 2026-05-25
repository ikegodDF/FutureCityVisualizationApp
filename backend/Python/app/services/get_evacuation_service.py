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
            extended_attributes.append({
                "people": row.get("people") or row.get("建物内人口_総数") or None,
                "shelterName": row.get("最寄避難先名称", "-"),
                "evacDistance": row.get("避難距離_m", "-"),
                "inundationDepth": row.get("浸水深_m", "-"),
                "evacuationTime": row.get("移動時間_高齢者_分", "-"),
                "tsunamiTime": row.get("津波到達時間_分", "-"),
                "c3Deaths": row.get("C3_死亡人口_総数", "-"),
                "c3DeathRate": row.get("C3_死亡率_総数", "0.0"),
                "c4Deaths": row.get("C4_死亡人口_総数", "-"),
                "c4DeathRate": row.get("C4_死亡率_総数", "0.0")
            })
        print(f"【EvacuationService】✅ CSVから {len(extended_attributes)} 件のデータを正常にパースしました。")
        return extended_attributes

    def merge_evacuation_data_with_policy(self, params: List[Model3D], missing_data_policy: Optional[str] = None) -> List[Model3D]:
        # 👑 【重要】もしデータがまだ読み込まれていなければ、ここで強制的に読み込むガードを追加
        if not self._extended_attributes:
            print("【EvacuationService】データが未ロードのため、ディレクトリから自動ロードを試みます。")
            self.ensure_loaded_from_directory()

        # 👑 パラメータまたはCSVが空の場合はマージできないので警告をコンソールに出す
        if not params:
            print("【EvacuationService】⚠️ 警告: フロントから渡されたparams(建物配列)が空です。")
            return params
        if not self._extended_attributes:
            print("【EvacuationService】⚠️ 警告: CSVのパースデータが空のため、マージをスキップします。")
            return params

        merge_count = min(len(params), len(self._extended_attributes))
        print(f"【EvacuationService】⚡ マージを開始します。建物数: {len(params)}, CSV行数: {len(self._extended_attributes)}, マージ対象数: {merge_count}")
        
        for i in range(merge_count):
            csv_attr = self._extended_attributes[i]
            building = params[i]

            if csv_attr["people"] is not None:
                try:
                    building.people = int(csv_attr["people"])
                except (ValueError, TypeError):
                    pass

            # Pydanticオブジェクトに詰め込む
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
            
        print(f"【EvacuationService】🎉 {merge_count} 件の建物への tsunami_data マージが完了しました。")
        return params
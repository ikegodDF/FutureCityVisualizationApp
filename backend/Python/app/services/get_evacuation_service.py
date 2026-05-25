import csv
import os
from io import TextIOBase
from typing import Optional, Union, List, Dict, Any

# 💡 Pydanticスキーマ側で定義した子オブジェクトの型をインポート
# （パスはプロジェクトのディレクトリ構造に合わせて適宜調整してください）
from app.models.schemas import TsunamiEvacuationData, Model3D

from ..core.config import settings

class GetEvacuationService:
    def __init__(self):
        # 👑 CSVの各行から抽出した、避難・被害関連の属性リスト
        self._extended_attributes: List[Dict[str, Any]] = []
        self._source_mtime: Optional[float] = None

    def ensure_loaded_from_directory(self) -> None:
        """
        設定ファイルで指定されたディレクトリからCSVファイルを自動ロードする。
        """
        filename = getattr(settings, "tsunami_evacuation_file", "津波避難データ_豊浦.csv")
        file_path = os.path.join(settings.data_dir, filename)
        self._load_from_path(file_path)

    def load_from_file(self, file_obj: Union[TextIOBase, bytes]) -> None:
        """アップロードされたファイルオブジェクトからデータを直接ロードする"""
        if isinstance(file_obj, bytes):
            text_stream = file_obj.decode("utf-8").splitlines()
        else:
            text_stream = file_obj
        reader = csv.DictReader(text_stream)
        self._extended_attributes = self._parse_rows(reader)
        self._source_mtime = None

    def _load_from_path(self, file_path: str) -> None:
        """パスを指定してCSVからデータをロード（更新日時チェック付き）"""
        if not os.path.exists(file_path):
            print(f"【EvacuationService】警告: ファイルが見つかりません: {file_path}")
            return
        current_mtime = os.path.getmtime(file_path)
        if self._source_mtime and self._source_mtime == current_mtime:
            return  # 既に最新のデータがロードされていれば何もしない
            
        with open(file_path, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            self._extended_attributes = self._parse_rows(reader)
            self._source_mtime = current_mtime

    def _parse_rows(self, reader: csv.DictReader) -> List[Dict[str, Any]]:
        """CSVの行から必要な津波避難シミュレーション属性を抽出する内部関数"""
        extended_attributes: List[Dict[str, Any]] = []

        for row in reader:
            extended_attributes.append({
                # 💡 空白行や空文字を明示的に None にフォールバックする
                "people": row.get("people") or row.get("建物内人口_総数") or None,
                "shelterName": row.get("最寄避難先名称", "-"),
                "evacDistance": row.get("避難距離_m", "-"),
                "inundationDepth": row.get("浸水深_m", "-"),
                "tsunamiTime": row.get("津波到達時間_分", "-"),
                "c1Deaths": row.get("C1_死亡人口_総数", "-"),
                "c1DeathRate": row.get("C1_死亡率_総数", "0.0")
            })
        
        print(f"【EvacuationService】CSVから {len(extended_attributes)} 件 of 避難属性データをパースしました。")
        return extended_attributes

    def merge_evacuation_data_with_policy(
        self, params: List[Model3D], missing_data_policy: Optional[str] = None
    ) -> List[Model3D]:
        """
        👑 CSVと params のインデックス(配列の順番)が 1:1 で一致している前提でマージする関数
        """
        # 実行前に未ロードであれば読み込む（安全対策）
        if not self._extended_attributes:
            self.ensure_loaded_from_directory()

        if not params or not self._extended_attributes:
            print("【EvacuationService】警告: params または CSVデータが空のためマージをスキップします。")
            return params

        # ループ回数は、paramsの長さとCSVの行数の少ない方に合わせる（範囲外エラー防止）
        merge_count = min(len(params), len(self._extended_attributes))
        
        for i in range(merge_count):
            csv_attr = self._extended_attributes[i]
            building = params[i]  # 💡 Pydanticの Model3D インスタンスが取得される

            # 1. 💡 人数(people)が取得できていれば、ドット記法で上書き
            if csv_attr["people"] is not None:
                try:
                    building.people = int(csv_attr["people"])
                except (ValueError, TypeError):
                    pass

            # 2. 💡 スキーマで定義した TsunamiEvacuationData オブジェクトとして代入する
            # これにより、APIレスポンスの出力時にバリデーションエラーが出なくなります。
            building.tsunami_data = TsunamiEvacuationData(
                shelterName=str(csv_attr["shelterName"]),
                evacDistance=str(csv_attr["evacDistance"]),
                inundationDepth=str(csv_attr["inundationDepth"]),
                tsunamiTime=str(csv_attr["tsunamiTime"]),
                c1Deaths=str(csv_attr["c1Deaths"]),
                c1DeathRate=str(csv_attr["c1DeathRate"])
            )

        print(f"【EvacuationService】インデックス基準で {merge_count} 件の建物に津波避難データをマージしました。")
        return params
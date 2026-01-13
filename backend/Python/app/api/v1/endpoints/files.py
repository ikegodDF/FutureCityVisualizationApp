"""
ファイルリスト取得APIエンドポイント
"""
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from typing import List

router = APIRouter()

@router.get("/files/gml", response_model=List[str])
async def get_gml_files(directory: str = "sapporo_cityGML"):
    """
    指定されたディレクトリ内のGMLファイルのリストを取得
    
    Args:
        directory: ディレクトリ名（デフォルト: sapporo_cityGML）
    
    Returns:
        GMLファイル名のリスト
    """
    try:
        # フロントエンドのpublicディレクトリを基準にパスを構築
        # プロジェクトルートからの相対パス
        base_path = Path(__file__).parent.parent.parent.parent.parent.parent
        gml_dir = base_path / "frontend" / "public" / "models" / directory
        
        if not gml_dir.exists():
            raise HTTPException(status_code=404, detail=f"Directory not found: {directory}")
        
        # .gmlファイルのみを取得
        gml_files = [
            f.name for f in gml_dir.iterdir() 
            if f.is_file() and f.suffix.lower() == '.gml'
        ]
        
        # ファイル名でソート
        gml_files.sort()
        
        return gml_files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading directory: {str(e)}")

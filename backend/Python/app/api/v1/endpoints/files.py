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
        # 複数のパス候補を試す
        current_file = Path(__file__).resolve()
        current_dir = Path(os.getcwd())
        # プロジェクトルートは backend/Python の2つ上 (FutureCityVisualizationApp) を想定
        project_root = current_dir.parent.parent
        
        # パス候補のリスト
        path_candidates = [
            # プロジェクトルート/frontend/public/models
            project_root / "frontend" / "public" / "models" / directory,
            # __file__ から辿った場合（念のため）
            current_file.parent.parent.parent.parent.parent.parent / "frontend" / "public" / "models" / directory,
            # 現在の作業ディレクトリから
            current_dir / "frontend" / "public" / "models" / directory,
            # 親ディレクトリから
            current_dir.parent / "frontend" / "public" / "models" / directory,
        ]
        
        gml_dir = None
        searched_paths = []
        
        for candidate_path in path_candidates:
            candidate_path = candidate_path.resolve()
            searched_paths.append(str(candidate_path))
            if candidate_path.exists() and candidate_path.is_dir():
                gml_dir = candidate_path
                break
        
        if gml_dir is None:
            raise HTTPException(
                status_code=404, 
                detail=f"Directory not found: {directory}. Searched paths:\n" + "\n".join(searched_paths)
            )
        
        # .gmlファイルのみを取得
        gml_files = [
            f.name for f in gml_dir.iterdir() 
            if f.is_file() and f.suffix.lower() == '.gml'
        ]
        
        # ファイル名でソート
        gml_files.sort()
        
        return gml_files
    except HTTPException:
        # HTTPExceptionはそのまま再スロー
        raise
    except Exception as e:
        import traceback
        error_detail = f"Error reading directory: {str(e)}\nTraceback:\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)

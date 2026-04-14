# Pydanticスキーマ
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime

class Model3D(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: int
    name: str
    year: Optional[int] = None
    show: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    seismic_intensity: Optional[float] = None
    thunami_inundation_depth: Optional[float] = None
    BuildingDetail: Optional[dict] = None
    # 被害計算ができなかったかどうかを示すフラグ（フロントで黒表示などに使用）
    earthquake_uncomputable: Optional[bool] = None
    thunami_uncomputable: Optional[bool] = None

class BuildingDetail(BaseModel):
    buildingStructureType: int =None
    storeysAboveGround: int =None
    buildingArea: float =None
    buildingUsage: int =None
    architecturalPeriod: int =None

class ModelSearchQuery(BaseModel):
    min_lat: Optional[float] = None
    max_lat: Optional[float] = None
    min_lon: Optional[float] = None
    max_lon: Optional[float] = None
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    limit: int = 100

class ComputeRequest(BaseModel):
    method: str
    appStateYear: int
    disasterState: str
    # 欠損データの扱い方針（UIから選択）
    # - strict: 欠損がある建物は計算しない（フロントで黒表示などに使える）
    # - fallback_fixed: 欠損があっても固定値で補完して計算する（現状互換のデフォルト）
    missing_data_policy: Literal["strict", "fallback_fixed"] = "strict"
    params: List[Model3D]

class ComputeResponse(BaseModel):
    result: List[Model3D]
    duration_ms: float
    timestamp: datetime

class Models(BaseModel): 
    models: List[Model3D]

class AnalysisResponse(BaseModel):
    result: List[List[int]]
    duration_ms: float
    timestamp: datetime

# Pydanticスキーマ
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime

class BuildingDetail(BaseModel):
    buildingStructureType: Optional[int] = None
    storeysAboveGround: Optional[int] = None
    buildingArea: Optional[float] = None
    buildingHeight: Optional[float] = None
    buildingUsage: Optional[int] = None
    architecturalPeriod: Optional[int] = None
    buildingPopulation: Optional[int] = None


class Model3D(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: int
    name: str
    year: Optional[int] = None
    show: bool
    isDamage: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    seismic_intensity: Optional[float] = None
    tsunami_inundation_depth: Optional[float] = None
    tsunami_arrival_time: Optional[int] = None
    buildingDetail: Optional[BuildingDetail] = None
    # 被害計算ができなかったかどうかを示すフラグ（フロントで黒表示などに使用）
    earthquake_uncomputable: Optional[bool] = None
    tsunami_uncomputable: Optional[bool] = None

class selectedRange(BaseModel):
    models: List[int]
    order: int
    period: dict
    polygon: List[dict]

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
    region: str = "mukawa"
    # 欠損データの扱い方針（UIから選択）
    # - strict: 欠損がある建物は計算しない（フロントで黒表示などに使える）
    # - fallback_fixed: 欠損があっても固定値で補完して計算する（現状互換のデフォルト）
    missing_data_policy: Literal["strict", "fallback_fixed"] = "strict"
    params: List[Model3D]
    selectedRanges: Optional[List[selectedRange]] = []

class ComputeResponse(BaseModel):
    result: List[Model3D]
    total_victims: Optional[float] = 0
    duration_ms: float
    timestamp: datetime

class Models(BaseModel): 
    models: List[Model3D]

class AnalysisResponse(BaseModel):
    result: List[List[List[int]]]
    duration_ms: float
    timestamp: datetime

class DistributionRequest(BaseModel):
    region: str = "mukawa"

class DistributionResponse(BaseModel):
    distribution: dict
    duration_ms: float
    timestamp: datetime

class BuildingPopulationRequest(ComputeRequest):
    population: dict

class RegionListResponse(BaseModel):
    regions: List[dict]
    duration_ms: float
    timestamp: datetime

class NewPredictionRequest(BaseModel):
    method: str
    appStateYear: int
    addYear: int
    disasterState: str
    percentage: float
    region: str = "mukawa"
    # 欠損データの扱い方針（UIから選択）
    # - strict: 欠損がある建物は計算しない（フロントで黒表示などに使える）
    # - fallback_fixed: 欠損があっても固定値で補完して計算する（現状互換のデフォルト）
    missing_data_policy: Literal["strict", "fallback_fixed"] = "strict"
    params: List[Model3D]
    selectedRanges: Optional[List[selectedRange]] = []

class NewPredictionResponse(BaseModel):
    deletes:List[int]
    models:List[Model3D]
    add_num:List[int]
    duration_ms:float
    timestamp: datetime

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime

class BuildingDetail(BaseModel):
    buildingStructureType: Optional[int] = None
    storeysAboveGround: Optional[int] = None
    buildingArea: Optional[float] = None
    buildingUsage: Optional[int] = None
    architecturalPeriod: Optional[int] = None
    peopleNum: Optional[int] = None

class TsunamiEvacuationData(BaseModel):
    shelterName: str = Field(default="-", description="最寄避難先名称")
    evacDistance: str = Field(default="-", description="避難距離_m")
    inundationDepth: str = Field(default="-", description="浸水深_m")
    evacuationTime: str = Field(default="-", description="移動時間_高齢者_分")
    tsunamiTime: str = Field(default="-", description="津波到達時間_分")
    
    # 👑 C3, C4 の死亡人口・死亡率を追加
    c3Deaths: str = Field(default="-", description="C3_死亡人口_総数")
    c3DeathRate: str = Field(default="0.0", description="C3_死亡率_総数")
    c4Deaths: str = Field(default="-", description="C4_死亡人口_総数")
    c4DeathRate: str = Field(default="0.0", description="C4_死亡率_総数")

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
    BuildingDetail: Optional[dict] = None
    
    # 👑 【追加】PythonのCSVマージやフロントで参照される人口・津波避難データ用フィールド
    people: Optional[int] = None
    tsunami_data: Optional[TsunamiEvacuationData] = None # 👈 これで辞書を入れても型安全に返却されます
    evacuation_data: Optional[Dict] = None

    # 被害計算ができなかったかどうかを示すフラグ
    earthquake_uncomputable: Optional[bool] = None
    tsunami_uncomputable: Optional[bool] = None

# 👑 【詳細化】ポリゴンの座標構造
class PolygonCoordinate(BaseModel):
    lat: float
    lon: float

# 👑 【詳細化】施策の適用期間
class PolicyPeriod(BaseModel):
    start: int
    end: int

class selectedRange(BaseModel):
    models: List[int]
    order: str = Field(description="施策名（文字列に対応できるよう str に修正）") # 👈 int から str へ修正
    period: PolicyPeriod
    polygon: List[PolygonCoordinate]

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
    result: List[List[int]]
    duration_ms: float
    timestamp: datetime

class DistributionRequest(BaseModel):
    pass

class DistributionResponse(BaseModel):
    distribution: dict
    duration_ms: float
    timestamp: datetime
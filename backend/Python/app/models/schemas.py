# Pydanticスキーマ
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
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

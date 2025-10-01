# Pydanticスキーマ
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class Model3D(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: int
    name: str
    year: int
    show: bool
    latitude: float
    longitude: float

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
    params: List[Model3D]

class ComputeResponse(BaseModel):
    result: Dict[str, Any]
    duration_ms: float
    timestamp: datetime

class Models(BaseModel): 
    models: List[Model3D]
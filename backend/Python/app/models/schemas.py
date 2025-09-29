# Pydanticスキーマ
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class Model3D(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    height: float
    year_built: Optional[int] = None
    color: Optional[str] = None
    is_visible: bool = True

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
    params: Dict[str, Any]

class ComputeResponse(BaseModel):
    result: Dict[str, Any]
    duration_ms: float
    timestamp: datetime
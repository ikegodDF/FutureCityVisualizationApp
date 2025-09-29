from fastapi import APIRouter, HTTPException, Query
from typing import List
from ....models.schemas import Model3D, ModelSearchQuery
from ....services.data_service import DataService

router = APIRouter()
data_service = DataService()

@router.get("/models", response_model=List[Model3D])
def get_models(
    min_lat: float = Query(None, description="最小緯度"),
    max_lat: float = Query(None, description="最大緯度"),
    min_lon: float = Query(None, description="最小経度"),
    max_lon: float = Query(None, description="最大経度"),
    year_from: int = Query(None, description="開始年"),
    year_to: int = Query(None, description="終了年"),
    limit: int = Query(100, description="取得件数上限")
):
    query = ModelSearchQuery(
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        year_from=year_from,
        year_to=year_to,
        limit=limit
    )
    return data_service.get_models(query)

@router.get("/models/{model_id}", response_model=Model3D)
def get_model(model_id: int):
    model = data_service.get_model_by_id(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model
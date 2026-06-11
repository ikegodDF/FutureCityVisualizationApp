from datetime import datetime
import time
from fastapi import APIRouter

from app.core.regions import list_regions
from app.models.schemas import RegionListResponse

router = APIRouter(prefix="/regions")


@router.get("/", response_model=RegionListResponse)
def get_regions():
    start_time = time.time()
    return RegionListResponse(
        regions=list_regions(),
        duration_ms=(time.time() - start_time) * 1000,
        timestamp=datetime.now(),
    )

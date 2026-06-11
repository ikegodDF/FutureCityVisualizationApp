from datetime import datetime
import time
from fastapi import APIRouter

from app.models.schemas import DistributionRequest, DistributionResponse
from app.services.region_data_manager import region_data_manager

router = APIRouter(prefix="/get_distribution")


@router.post("/", response_model=DistributionResponse)
def get_distribution(request: DistributionRequest):
    start_time = time.time()

    seismic_service = region_data_manager.get_seismic_service(request.region)
    tsunami_service = region_data_manager.get_tsunami_service(request.region)

    export = {
        "seismic": seismic_service.get_distribution(),
        "tsunami": tsunami_service.get_distribution(),
    }

    duration = (time.time() - start_time) * 1000

    return DistributionResponse(
        distribution=export,
        duration_ms=duration,
        timestamp=datetime.now(),
    )

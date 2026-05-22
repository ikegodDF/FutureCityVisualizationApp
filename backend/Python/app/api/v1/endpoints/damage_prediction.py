from fastapi import APIRouter
from app.models.schemas import ComputeRequest, ComputeResponse
from app.services.get_seismic_service import GetSeismicService
from app.services.compute_service import ComputeService
from app.services.get_tsunami_service import GetTsunamiService
import time

router = APIRouter(prefix="/damage_prediction")
get_seismic_service = GetSeismicService()
compute_service = ComputeService()
get_tsunami_service = GetTsunamiService()

@router.post("/earthquake", response_model=ComputeResponse)
def damage_prediction(request: ComputeRequest):
    start_time = time.time()
    request.params = get_seismic_service.get_seismic_data_with_policy(
        request.params,
        missing_data_policy=request.missing_data_policy,
    )
    return compute_service.compute(request)


@router.post("/tsunami", response_model=ComputeResponse)
def tsunami_damage_prediction(request: ComputeRequest):
    start_time = time.time()
    request.params = get_tsunami_service.get_tsunami_data_with_policy(
        request.params,
        missing_data_policy=request.missing_data_policy,
    )
    return compute_service.compute(request)

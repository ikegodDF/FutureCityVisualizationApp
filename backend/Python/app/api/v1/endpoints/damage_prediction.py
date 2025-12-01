from fastapi import APIRouter
from app.models.schemas import ComputeRequest, ComputeResponse
from app.services.get_seismic_service import GetSeismicService
from app.services.compute_service import ComputeService
from app.services.get_thunami_service import GetThunamiService
import time

router = APIRouter(prefix="/damage_prediction")
get_seismic_service = GetSeismicService()
compute_service = ComputeService()
get_thunami_service = GetThunamiService()

@router.post("/earthquake", response_model=ComputeResponse)
def damage_prediction(request: ComputeRequest):
    start_time = time.time()
    request.params = get_seismic_service.get_seismic_data(request.params)
    return compute_service.compute(request)


@router.post("/thunami", response_model=ComputeResponse)
def thunami_damage_prediction(request: ComputeRequest):
    start_time = time.time()
    request.params = get_thunami_service.get_thunami_data(request.params)
    return compute_service.compute(request)

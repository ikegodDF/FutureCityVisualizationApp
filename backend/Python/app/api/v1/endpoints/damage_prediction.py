from fastapi import APIRouter
from app.models.schemas import ComputeRequest, ComputeResponse
from app.services.get_seismic_service import GetSeismicService
from app.services.compute_service import ComputeService
import time

router = APIRouter(prefix="/damage_prediction")
get_seismic_service = GetSeismicService()
compute_service = ComputeService()

@router.post("/", response_model=ComputeResponse)
def damage_prediction(request: ComputeRequest):
    start_time = time.time()
    request.params = get_seismic_service.get_seismic_data(request.params)
    return compute_service.compute(request)

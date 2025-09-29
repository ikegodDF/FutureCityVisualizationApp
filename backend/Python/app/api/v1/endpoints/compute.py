from fastapi import APIRouter
from ....models.schemas import ComputeRequest, ComputeResponse
from ....services.compute_service import ComputeService

router = APIRouter()
compute_service = ComputeService()

@router.post("/compute", response_model=ComputeResponse)
def compute(request: ComputeRequest):
    return compute_service.compute(request)
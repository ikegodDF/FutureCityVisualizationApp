from fastapi import APIRouter
from app.models.schemas import ComputeRequest, ComputeResponse
from app.services.compute_service import ComputeService
from fastapi import HTTPException


router = APIRouter(prefix="/calculate") 
compute_service = ComputeService()

@router.post("/", response_model=ComputeRequest)
def calculate(request: ComputeRequest):
    if request.method not in ["building_retention_rate", "earthquake_damage_assessment", "thunami_damage_assessment"]:
        raise HTTPException(status_code=400, detail="Invalid method")
    return request
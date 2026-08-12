from fastapi import APIRouter
from app.models.schemas import ComputeRequest, ComputeResponse, BuildingPopulationRequest, NewPredictionRequest, NewPredictionResponse
from app.services.compute_service import ComputeService
from fastapi import HTTPException


router = APIRouter(prefix="/calculate") 
compute_service = ComputeService()

@router.post("/", response_model=ComputeResponse)
def calculate(request: ComputeRequest):
    if request.method not in ["building_retention_rate", "earthquake_damage_assessment", "tsunami_damage_assessment"]:
        raise HTTPException(status_code=400, detail="Invalid method")
    return compute_service.compute(request)

@router.post("/renew_building_population", response_model = ComputeResponse)
def renew_building_population(request: BuildingPopulationRequest):
    return compute_service.building_population(request)



@router.post("/new_prediction", response_model=NewPredictionResponse)
def new_prediction(request: NewPredictionRequest):
    if request.method not in ["building_retention_rate"]:
        raise HTTPException(status_code=400, detail="Invalid method")
    return compute_service.new_prediction(request)
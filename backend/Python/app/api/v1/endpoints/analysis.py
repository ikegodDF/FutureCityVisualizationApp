from fastapi import APIRouter
from app.models.schemas import AnalysisRequest, AnalysisResponse
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analysis")
analysis_service = AnalysisService()

@router.post("/", response_model=AnalysisResponse)
def analysis(request: AnalysisRequest):
    return analysis_service.analyze(request)
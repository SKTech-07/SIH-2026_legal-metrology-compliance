from abc import ABC, abstractmethod
from typing import Dict, Any, List
from pydantic import BaseModel, Field


class DetectionItem(BaseModel):
    text: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    language: str = "en"
    bbox: List[int] = Field(..., min_length=4, max_length=4)  # [x, y, w, h]
    declaration_type: str = "OTHER"  # e.g., MRP, NET_QUANTITY, PACKING_DATE, MANUFACTURER, etc.


class AIModelResponse(BaseModel):
    model_name: str
    model_version: str
    request_id: str
    processing_time: float
    detections: List[DetectionItem]
    raw_response: Dict[str, Any] = {}


class AIModelClient(ABC):
    @abstractmethod
    async def predict(self, image_path: str) -> AIModelResponse:
        """Execute prediction on given image file path and return normalized response."""
        pass

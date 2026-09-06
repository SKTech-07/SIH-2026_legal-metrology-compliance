import uuid
import time
import logging
import httpx
from app.ai.model_client import AIModelClient, AIModelResponse, DetectionItem
from app.config import settings

logger = logging.getLogger("legal_metrology.ai")


class ExternalModelClient(AIModelClient):
    """External REST API Client adapter for the trained Legal Metrology AI model."""

    def __init__(self):
        self.endpoint = settings.AI_MODEL_URL
        self.api_key = settings.AI_MODEL_API_KEY
        self.timeout = settings.AI_MODEL_TIMEOUT

    async def predict(self, image_path: str) -> AIModelResponse:
        start_time = time.time()
        if not self.endpoint:
            raise ValueError("AI_MODEL_URL is not configured for ExternalModelClient")

        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
            with open(image_path, "rb") as img_file:
                files = {"file": (image_path, img_file, "image/jpeg")}
                response = await client.post(self.endpoint, files=files, headers=headers)
                response.raise_for_status()
                data = response.json()

        processing_duration = round(time.time() - start_time, 3)

        detections = []
        raw_detections = data.get("detections", [])
        for item in raw_detections:
            detections.append(
                DetectionItem(
                    text=item.get("text", ""),
                    confidence=float(item.get("confidence", 0.9)),
                    language=item.get("language", "en"),
                    bbox=item.get("bbox", [0, 0, 100, 100]),
                    declaration_type=item.get("declaration_type", "OTHER")
                )
            )

        return AIModelResponse(
            model_name=data.get("model_name", settings.AI_MODEL_NAME),
            model_version=data.get("model_version", settings.AI_MODEL_VERSION),
            request_id=data.get("request_id", str(uuid.uuid4())),
            processing_time=processing_duration,
            detections=detections,
            raw_response=data
        )

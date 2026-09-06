import uuid
import time
import logging
from app.ai.model_client import AIModelClient, AIModelResponse, DetectionItem
from app.config import settings

logger = logging.getLogger("legal_metrology.ai.mock_client")


class MockAIModelClient(AIModelClient):
    """
    Local OCR AI Model Adapter for Legal Metrology.
    Uses easyocr to extract real text from the actual uploaded images.
    """

    async def predict(self, image_path: str) -> AIModelResponse:
        start_time = time.time()
        
        try:
            from paddleocr import PaddleOCR
        except ImportError as e:
            logger.error("Required OCR library paddleocr not found. Please run: pip install paddleocr paddlepaddle")
            raise RuntimeError("OCR library (paddleocr) is not installed.") from e

        try:
            # reader can be cached globally in a production scenario
            reader = PaddleOCR(use_angle_cls=True, lang='en')
            results = reader.ocr(image_path, cls=True)
        except Exception as e:
            logger.error(f"Failed to process image {image_path} with paddleocr: {e}")
            raise RuntimeError(f"OCR processing failed for {image_path}.") from e

        detections = []
        if results and results[0]:
            for line in results[0]:
                bbox, (text, confidence) = line
                text = text.strip()
                if text and confidence > 0:
                    xs = [pt[0] for pt in bbox]
                    ys = [pt[1] for pt in bbox]
                    x = int(min(xs))
                    y = int(min(ys))
                    w = int(max(xs) - x)
                    h = int(max(ys) - y)
                    
                    detections.append(
                        DetectionItem(
                            text=text,
                            confidence=float(confidence),
                            language="en",
                            bbox=[x, y, w, h],
                            declaration_type="OTHER"  # Default to OTHER, downstream NLP can classify
                        )
                    )
        
        processing_duration = round(time.time() - start_time, 3)
        request_id = str(uuid.uuid4())
        
        return AIModelResponse(
            model_name="Local-PaddleOCR",
            model_version="2.8.1",
            request_id=request_id,
            processing_time=processing_duration,
            detections=detections,
            raw_response={
                "provider": "MockAIModelClient_PaddleOCR",
                "status": "success",
                "total_detected": len(detections)
            }
        )


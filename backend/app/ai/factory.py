import logging
from app.ai.model_client import AIModelClient
from app.ai.mock_client import MockAIModelClient
from app.ai.external_client import ExternalModelClient
from app.config import settings

logger = logging.getLogger("legal_metrology.ai.factory")


def get_ai_model_client() -> AIModelClient:
    provider = settings.AI_PROVIDER.lower()

    if provider == "local":
        from app.ai.pipeline_client import PipelineModelClient
        logger.info("Using PipelineModelClient (ML compliance pipeline) for AI inference")
        return PipelineModelClient()

    if provider == "external" and settings.AI_MODEL_URL:
        logger.info("Using ExternalModelClient for AI inference")
        return ExternalModelClient()

    # Default to Mock client for testing & standalone environment
    logger.info("Using MockAIModelClient for AI inference")
    return MockAIModelClient()

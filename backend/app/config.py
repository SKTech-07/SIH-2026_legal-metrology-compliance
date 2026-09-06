import os
from typing import Optional
from pydantic_settings import BaseSettings


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "legal_metrology.db")
DEFAULT_DB_URL = f"sqlite:///{DB_PATH.replace(chr(92), '/')}"

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI-Powered Legal Metrology Compliance Platform"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        DEFAULT_DB_URL
    )
    
    # JWT Auth
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-key-legal-metrology-2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # Storage
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "storage_data")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "storage_data/uploads")
    ENHANCED_DIR: str = os.getenv("ENHANCED_DIR", "storage_data/enhanced")
    EVIDENCE_DIR: str = os.getenv("EVIDENCE_DIR", "storage_data/evidence")
    REPORT_DIR: str = os.getenv("REPORT_DIR", "storage_data/reports")
    
    # AI Provider Settings
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "mock")  # mock | external | local
    AI_MODEL_URL: Optional[str] = os.getenv("AI_MODEL_URL", None)
    AI_MODEL_API_KEY: Optional[str] = os.getenv("AI_MODEL_API_KEY", None)
    AI_MODEL_NAME: str = os.getenv("AI_MODEL_NAME", "legal-metrology-vision-v1")
    AI_MODEL_VERSION: str = os.getenv("AI_MODEL_VERSION", "1.0.0")
    AI_MODEL_TIMEOUT: int = int(os.getenv("AI_MODEL_TIMEOUT", "30"))
    
    # Translation
    TRANSLATION_PROVIDER: str = os.getenv("TRANSLATION_PROVIDER", "built_in")

    class Config:
        case_sensitive = True
        env_file = os.path.join(os.path.dirname(BASE_DIR), ".env")


settings = Settings()

# Ensure storage directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.ENHANCED_DIR, exist_ok=True)
os.makedirs(settings.EVIDENCE_DIR, exist_ok=True)
os.makedirs(settings.REPORT_DIR, exist_ok=True)

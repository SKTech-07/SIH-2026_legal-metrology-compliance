import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database.connection import engine, SessionLocal, Base
from app.database.seed import seed_database
from app.api import (
    auth_router, users_router, assignments_router, stores_router,
    inspections_router, products_router, copies_router, images_router,
    quality_router, enhancement_router, ocr_router, declarations_router,
    compliance_router, rules_router, violations_router, reviews_router,
    reports_router, analytics_router, search_router
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("legal_metrology.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions: seed database
    logger.info("Initializing database tables and seeding default records...")
    from app.database.init_db import init_db
    init_db()
    
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="AI-Powered Legal Metrology Packaged Commodity Compliance API",
    description="Production-grade API for Legal Metrology inspection, 360 image quality enhancement, AI model adapter, compliance rule evaluation, and human review.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Routers
v1 = settings.API_V1_STR
app.include_router(auth_router, prefix=v1)
app.include_router(users_router, prefix=v1)
app.include_router(assignments_router, prefix=v1)
app.include_router(stores_router, prefix=v1)
app.include_router(inspections_router, prefix=v1)
app.include_router(products_router, prefix=v1)
app.include_router(copies_router, prefix=v1)
app.include_router(images_router, prefix=v1)
app.include_router(quality_router, prefix=v1)
app.include_router(enhancement_router, prefix=v1)
app.include_router(ocr_router, prefix=v1)
app.include_router(declarations_router, prefix=v1)
app.include_router(compliance_router, prefix=v1)
app.include_router(rules_router, prefix=v1)
app.include_router(violations_router, prefix=v1)
app.include_router(reviews_router, prefix=v1)
app.include_router(reports_router, prefix=v1)
app.include_router(analytics_router, prefix=v1)
app.include_router(search_router, prefix=v1)


@app.get("/")
def root():
    return {
        "title": settings.PROJECT_NAME,
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
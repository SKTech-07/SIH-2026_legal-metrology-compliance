from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.assignments import router as assignments_router
from app.api.stores import router as stores_router
from app.api.inspections import router as inspections_router
from app.api.products import router as products_router
from app.api.copies import router as copies_router
from app.api.images import router as images_router
from app.api.quality import router as quality_router
from app.api.enhancement import router as enhancement_router
from app.api.ocr import router as ocr_router
from app.api.declarations import router as declarations_router
from app.api.compliance import router as compliance_router
from app.api.rules import router as rules_router
from app.api.violations import router as violations_router
from app.api.reviews import router as reviews_router
from app.api.reports import router as reports_router
from app.api.analytics import router as analytics_router
from app.api.search import router as search_router

__all__ = [
    "auth_router", "users_router", "assignments_router", "stores_router",
    "inspections_router", "products_router", "copies_router", "images_router",
    "quality_router", "enhancement_router", "ocr_router", "declarations_router",
    "compliance_router", "rules_router", "violations_router", "reviews_router",
    "reports_router", "analytics_router", "search_router"
]

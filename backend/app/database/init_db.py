import logging
from app.database.connection import engine, Base

logger = logging.getLogger("legal_metrology.init_db")

def init_db():
    logger.info("Importing all models to register with Base metadata...")
    import app.models.all_models
    
    logger.info("Creating all database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")

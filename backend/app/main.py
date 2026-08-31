from fastapi import FastAPI
from sqlalchemy import text

from app.database.connection import engine

app = FastAPI(
    title="Legal Metrology Compliance API",
    description="Backend API for the Legal Metrology Packaged Commodities compliance system",
    version="1.0.0",
)


@app.get("/")
def root():
    return {
        "message": "Legal Metrology Compliance API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/database-test")
def database_test():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        value = result.scalar()

    return {
        "database": "connected",
        "test_result": value
    }
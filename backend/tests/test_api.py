import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import Base, engine, SessionLocal
from app.database.seed import seed_database

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
    yield


def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_admin_login():
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@legalmetrology.gov.in",
        "password": "AdminPassword123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role_name"] == "ADMIN"


def test_inspector_login():
    res = client.post("/api/v1/auth/login", json={
        "email": "inspector.sharma@legalmetrology.gov.in",
        "password": "InspectorPassword123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role_name"] == "INSPECTOR"


def test_rbac_admin_only_endpoint_forbidden_for_inspector():
    # Login as Inspector
    insp_token = client.post("/api/v1/auth/login", json={
        "email": "inspector.sharma@legalmetrology.gov.in",
        "password": "InspectorPassword123!"
    }).json()["access_token"]

    # Inspector attempting to create a user (Admin-only action)
    res = client.post(
        "/api/v1/users",
        json={"email": "hacker@test.com", "password": "pass", "full_name": "Test", "role_name": "ADMIN"},
        headers={"Authorization": f"Bearer {insp_token}"}
    )
    assert res.status_code == 403


def test_copy_limit_max_5():
    # Login as Admin
    admin_token = client.post("/api/v1/auth/login", json={
        "email": "admin@legalmetrology.gov.in",
        "password": "AdminPassword123!"
    }).json()["access_token"]

    # Get seed inspection
    inspections = client.get("/api/v1/inspections", headers={"Authorization": f"Bearer {admin_token}"}).json()
    ins_id = inspections[0]["id"]

    # Create Product
    prod_res = client.post(
        f"/api/v1/products/inspections/{ins_id}/products",
        json={"name": "Test Chocolate Box", "category": "Food", "brand": "Apex", "barcode": "8901234567890"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert prod_res.status_code == 200
    prod_id = prod_res.json()["id"]

    # Add copies until limit 5 is reached
    for i in range(2, 6):
        res = client.post(f"/api/v1/products/{prod_id}/copies", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200

    # 6th copy should fail with 400 Bad Request
    fail_res = client.post(f"/api/v1/products/{prod_id}/copies", headers={"Authorization": f"Bearer {admin_token}"})
    assert fail_res.status_code == 400
    assert "Maximum physical product copies limit reached" in fail_res.json()["detail"]

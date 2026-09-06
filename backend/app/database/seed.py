import logging
from sqlalchemy.orm import Session
from app.database.connection import engine, SessionLocal, Base
from app.models import User, Role, Permission, RolePermission, Store, Rule, RuleVersion, Inspection, InspectionAssignment
from app.services.auth_service import hash_password
from app.rules.engine import DEFAULT_LEGAL_METROLOGY_RULES

logger = logging.getLogger("legal_metrology.seed")


def seed_database(db: Session):
    # 1. Create tables ensuring all models are imported
    from app.database.init_db import init_db
    init_db()

    # 2. Roles
    roles = ["ADMIN", "INSPECTOR"]
    for r_name in roles:
        existing = db.query(Role).filter(Role.name == r_name).first()
        if not existing:
            db.add(Role(name=r_name, description=f"{r_name} role"))

    # 3. Permissions
    admin_perms = [
        "users:view", "users:create", "users:update", "users:disable",
        "inspectors:assign", "inspectors:reassign", "inspections:create",
        "inspections:view_all", "inspections:update", "inspections:assign",
        "inspections:reassign", "inspections:monitor", "products:view",
        "images:view", "ai:view", "compliance:view", "violations:view",
        "rules:view", "rules:create", "rules:update", "rules:version",
        "reports:view", "reports:download", "history:view", "analytics:view",
        "audit:view", "settings:view", "settings:update"
    ]

    inspector_perms = [
        "inspections:view_assigned", "inspections:start", "inspections:update_assigned",
        "inspections:complete_assigned", "products:create", "products:update",
        "images:capture", "images:upload", "images:view", "images:replace",
        "ai:process", "ocr:view", "declarations:view", "declarations:edit",
        "declarations:verify", "compliance:view", "violations:view",
        "violations:confirm", "violations:reject", "reinspection:request",
        "reports:view", "reports:create", "reports:download", "history:view_own"
    ]

    for p in set(admin_perms + inspector_perms):
        if not db.query(Permission).filter(Permission.code == p).first():
            db.add(Permission(code=p, description=f"Permission for {p}"))

    for p in admin_perms:
        if not db.query(RolePermission).filter(RolePermission.role_name == "ADMIN", RolePermission.permission_code == p).first():
            db.add(RolePermission(role_name="ADMIN", permission_code=p))

    for p in inspector_perms:
        if not db.query(RolePermission).filter(RolePermission.role_name == "INSPECTOR", RolePermission.permission_code == p).first():
            db.add(RolePermission(role_name="INSPECTOR", permission_code=p))

    # 4. Default Seed Users (ADMIN & INSPECTOR)
    admin_user = db.query(User).filter(User.email == "admin@legalmetrology.gov.in").first()
    if not admin_user:
        admin_user = User(
            email="admin@legalmetrology.gov.in",
            hashed_password=hash_password("AdminPassword123!"),
            full_name="Rajesh Verma (Chief Admin)",
            role_name="ADMIN"
        )
        db.add(admin_user)

    inspector_user = db.query(User).filter(User.email == "inspector.sharma@legalmetrology.gov.in").first()
    if not inspector_user:
        inspector_user = User(
            email="inspector.sharma@legalmetrology.gov.in",
            hashed_password=hash_password("InspectorPassword123!"),
            full_name="Priya Sharma (Senior Inspector)",
            role_name="INSPECTOR"
        )
        db.add(inspector_user)

    db.commit()

    # 5. Default Rules
    for r in DEFAULT_LEGAL_METROLOGY_RULES:
        existing_rule = db.query(Rule).filter(Rule.code == r["code"]).first()
        if not existing_rule:
            rule_obj = Rule(
                code=r["code"],
                name=r["name"],
                declaration_type=r["declaration_type"],
                requirement=r["requirement"],
                validation_type=r["validation_type"],
                severity=r["severity"],
                status="ACTIVE"
            )
            db.add(rule_obj)
            db.flush()
            db.add(RuleVersion(rule_id=rule_obj.id, version_number=1, parameters_json={"status": "ACTIVE"}))

    # 6. Default Store & Inspection
    store = db.query(Store).filter(Store.license_number == "LM-DEL-2026-8890").first()
    if not store:
        store = Store(
            name="Apex Supermarket Ltd",
            license_number="LM-DEL-2026-8890",
            address="Plot 14, Connaught Place Sector 3",
            city="New Delhi",
            state="Delhi",
            pincode="110001",
            owner_name="Anil Kapoor",
            contact_number="+91-9876543210"
        )
        db.add(store)
        db.flush()

    inspection = db.query(Inspection).filter(Inspection.code == "INS-2026-00101").first()
    if not inspection and admin_user and inspector_user:
        inspection = Inspection(
            code="INS-2026-00101",
            store_id=store.id,
            created_by=admin_user.id,
            status="ASSIGNED",
            priority="HIGH",
            notes="Routine packaged commodity compliance inspection for packaged food & cosmetics."
        )
        db.add(inspection)
        db.flush()

        assignment = InspectionAssignment(
            inspection_id=inspection.id,
            inspector_id=inspector_user.id,
            assigned_by=admin_user.id,
            status="ASSIGNED",
            priority="HIGH",
            notes="Assigned by Chief Admin. Complete inspection of top 5 packaged brands."
        )
        db.add(assignment)

    db.commit()
    logger.info("Database successfully seeded with default users, rules, store, and inspection assignment.")

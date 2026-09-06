from typing import Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import User, RolePermission
from app.services.auth_service import decode_access_token

security = HTTPBearer()


import logging

logger = logging.getLogger("legal_metrology.auth")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 1. JWT Decode
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        logger.warning("JWT decode failed (invalid signature, expired, or malformed)")
        raise credentials_exception
    logger.info("JWT decode succeeded")

    # 2. Extract Subject
    user_id = payload.get("sub")
    if user_id is None:
        logger.warning("JWT missing 'sub' claim")
        raise credentials_exception
    # Ensure user_id is treated as a string (UUID)
    user_id = str(user_id)
    logger.info("JWT subject extracted")

    # 3. User Lookup
    logger.info("User lookup attempted")
    # Simplify boolean check to avoid dialect issues
    user = db.query(User).filter(User.id == user_id).first()
    
    if user is None:
        logger.warning(f"User not found in database for ID: {user_id}")
        raise credentials_exception
    logger.info("User found")

    # 4. Active Status
    if not user.is_active:
        logger.warning(f"User found but inactive: {user_id}")
        raise credentials_exception
    logger.info("User active status verified")

    return user


def require_permission(permission_code: str) -> Callable:
    """
    Granular RBAC permission dependency.
    Enforces HTTP 403 Forbidden if current user's role lacks required permission.
    """
    def permission_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Check if permission exists for user's role_name
        has_perm = db.query(RolePermission).filter(
            RolePermission.role_name == current_user.role_name,
            RolePermission.permission_code == permission_code
        ).first()

        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: User role '{current_user.role_name}' requires permission '{permission_code}'"
            )

        return current_user

    return permission_checker

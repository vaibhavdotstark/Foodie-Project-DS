from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from ..database import get_db_cursor
from ..schemas import UserCreate, UserUpdate, UserResponse
from ..auth import get_password_hash, get_current_user

router = APIRouter(prefix="/api/users", tags=["Users"], dependencies=[Depends(get_current_user)])

@router.get("", response_model=List[UserResponse])
def get_all_users():
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, organization_id, email, first_name, last_name, role, phone_number, is_active, last_login_at, created_at, updated_at
            FROM users
            WHERE is_deleted IS NOT TRUE
            ORDER BY first_name ASC;
        """)
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        results = []
        for r in rows:
            d = dict(zip(cols, r))
            d["id"] = str(d["id"])
            if d.get("organization_id"):
                d["organization_id"] = str(d["organization_id"])
            results.append(UserResponse(**d))
        return results

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, current_user: dict = Depends(get_current_user)):
    if payload.role == "OEM_MANAGER" and current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can provision OEM Manager accounts."
        )

    normalized_email = payload.email.strip().lower()

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM users WHERE LOWER(email) = %s;", (normalized_email,))
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'An account with email "{normalized_email}" is already registered. Email must be unique.'
            )

        pw_hash = get_password_hash(payload.password or "admin123")

        org_id = None if payload.role == "OEM_MANAGER" else payload.organization_id

        cur.execute("""
            INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, phone_number, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, true)
            RETURNING id, organization_id, email, first_name, last_name, role, phone_number, is_active, last_login_at, created_at, updated_at;
        """, (
            org_id,
            normalized_email,
            pw_hash,
            payload.first_name.strip(),
            payload.last_name.strip(),
            payload.role,
            payload.phone_number.strip() if payload.phone_number else None
        ))
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        if d.get("organization_id"):
            d["organization_id"] = str(d["organization_id"])
        return UserResponse(**d)

@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdate):
    pw_hash = get_password_hash(payload.password.strip()) if (payload.password and payload.password.strip()) else None
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE users
            SET first_name = COALESCE(%s, first_name),
                last_name = COALESCE(%s, last_name),
                role = COALESCE(%s, role),
                phone_number = %s,
                password_hash = COALESCE(%s, password_hash),
                is_active = COALESCE(%s, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, organization_id, email, first_name, last_name, role, phone_number, is_active, last_login_at, created_at, updated_at;
        """, (
            payload.first_name.strip() if payload.first_name else None,
            payload.last_name.strip() if payload.last_name else None,
            payload.role,
            payload.phone_number.strip() if payload.phone_number else None,
            pw_hash,
            payload.is_active,
            user_id
        ))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        if d.get("organization_id"):
            d["organization_id"] = str(d["organization_id"])
            cur.execute("SELECT company_name, client_code FROM organizations WHERE id = %s;", (d["organization_id"],))
            org_row = cur.fetchone()
            if org_row:
                d["company_name"] = org_row[0]
                d["client_code"] = org_row[1]
        return UserResponse(**d)

@router.delete("/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can delete user accounts."
        )

    if str(current_user.get("id")) == str(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Operation rejected: You cannot delete your currently active account."
        )

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE users
            SET is_deleted = TRUE,
                deleted_at = CURRENT_TIMESTAMP,
                is_active = FALSE
            WHERE id = %s AND is_deleted IS NOT TRUE
            RETURNING id, email, first_name, last_name;
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return {"message": "User deleted successfully.", "id": str(row[0]), "email": row[1]}

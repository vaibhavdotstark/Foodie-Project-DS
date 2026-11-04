from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from ..database import get_db_cursor
from ..schemas import UserCreate, UserUpdate, UserResponse
from ..auth import get_password_hash, get_current_user

router = APIRouter(prefix="/api/users", tags=["Users"], dependencies=[Depends(get_current_user)])

@router.get("", response_model=List[UserResponse])
def get_all_users(current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    user_org_id = current_user.get("organization_id")
    user_site_id = current_user.get("site_id")

    with get_db_cursor() as cur:
        if user_role == "OEM_MANAGER":
            cur.execute("""
                                                                                                                                                                            SELECT u.id, u.organization_id, u.site_id, s.site_name, u.location, u.email, u.first_name, u.last_name, u.role, u.phone_number, u.is_active, u.last_login_at, u.created_at, u.updated_at
                FROM users u
                LEFT JOIN sites s ON u.site_id = s.id
                WHERE u.is_deleted IS NOT TRUE
                ORDER BY u.first_name ASC;
            """)
        elif user_role in ("ORGANISATION_OWNER", "SITE_ADMIN"):
            cur.execute("""
                SELECT u.id, u.organization_id, u.site_id, s.site_name, u.location, u.email, u.first_name, u.last_name, u.role, u.phone_number, u.is_active, u.last_login_at, u.created_at, u.updated_at
                FROM users u
                LEFT JOIN sites s ON u.site_id = s.id
                WHERE u.is_deleted IS NOT TRUE AND u.organization_id = %s
                ORDER BY u.first_name ASC;
            """, (user_org_id,))
        else: # SITE_MANAGER or OPERATOR
            cur.execute("""
                SELECT u.id, u.organization_id, u.site_id, s.site_name, u.location, u.email, u.first_name, u.last_name, u.role, u.phone_number, u.is_active, u.last_login_at, u.created_at, u.updated_at
                FROM users u
                LEFT JOIN sites s ON u.site_id = s.id
                WHERE u.is_deleted IS NOT TRUE AND u.organization_id = %s AND (u.site_id = %s OR u.id = %s)
                ORDER BY u.first_name ASC;
            """, (user_org_id, user_site_id, current_user.get("id")))

        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        results = []
        for r in rows:
            d = dict(zip(cols, r))
            d["id"] = str(d["id"])
            if d.get("organization_id"):
                d["organization_id"] = str(d["organization_id"])
            if d.get("site_id"):
                d["site_id"] = str(d["site_id"])
            results.append(UserResponse(**d))
        return results

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    user_org_id = current_user.get("organization_id")

    if user_role == "OPERATOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Operators do not have permission to add users."
        )

    if payload.role == "OEM_MANAGER" and user_role != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can provision OEM Manager accounts."
        )

    if user_role != "OEM_MANAGER":
        if str(payload.organization_id) != str(user_org_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot create users for another organisation."
            )
        if user_role == "SITE_MANAGER" and payload.role != "OPERATOR":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Site Managers can only add operators."
            )

    normalized_email = payload.email.strip().lower()

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM users WHERE LOWER(email) = %s;", (normalized_email,))
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'An account with email "{normalized_email}" is already registered. Email must be unique.'
            )

        org_id = None if payload.role == "OEM_MANAGER" else payload.organization_id

        # Unique location check for SITE_MANAGER within the organisation
        if payload.role == "SITE_MANAGER" and payload.location and payload.location.strip() and org_id:
            norm_loc = payload.location.strip().lower()
            cur.execute("""
                SELECT id FROM users
                WHERE organization_id = %s
                  AND role = 'SITE_MANAGER'
                  AND LOWER(TRIM(location)) = %s
                  AND is_deleted IS NOT TRUE;
            """, (org_id, norm_loc))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f'A site manager with location "{payload.location.strip()}" already exists for this organisation. Location must be unique.'
                )

        pw_hash = get_password_hash(payload.password or "12345")

        creator_id = current_user.get("id")

        cur.execute("""
            INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, phone_number, location, is_active, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true, %s)
            RETURNING id, organization_id, email, first_name, last_name, role, phone_number, location, is_active, last_login_at, created_at, updated_at;
        """, (
            org_id,
            normalized_email,
            pw_hash,
            payload.first_name.strip(),
            payload.last_name.strip(),
            payload.role,
            payload.phone_number.strip() if payload.phone_number else None,
            payload.location.strip() if payload.location else None,
            creator_id
        ))
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        if d.get("organization_id"):
            d["organization_id"] = str(d["organization_id"])
            cur.execute("SELECT company_name, organisation_code FROM organizations WHERE id = %s;", (d["organization_id"],))
            org_row = cur.fetchone()
            if org_row:
                d["company_name"] = org_row[0]
                d["organisation_code"] = org_row[1]
                d["client_code"] = org_row[1]
        return UserResponse(**d)

@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    pw_hash = get_password_hash(payload.password.strip()) if (payload.password and payload.password.strip()) else None
    updater_id = current_user.get("id")
    updater_role = current_user.get("role")
    updater_org_id = current_user.get("organization_id")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT organization_id, role, location FROM users WHERE id = %s AND (is_deleted IS NOT TRUE);", (user_id,))
        existing_user_row = cur.fetchone()
        if not existing_user_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        target_org_id, cur_role, cur_loc = existing_user_row
        is_self = str(updater_id) == str(user_id)

        # Enforce tenant & role boundaries (Brian Okinyi RBAC spec & IDOR protection)
        if updater_role != "OEM_MANAGER":
            if updater_role == "OPERATOR" and not is_self:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Operators can only update their own profile.")

            if str(target_org_id) != str(updater_org_id):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot modify users in another organisation.")

            if payload.role == "OEM_MANAGER":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot assign OEM Manager role.")

            if updater_role == "SITE_MANAGER" and not is_self and cur_role != "OPERATOR":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Site Managers can only manage operators.")

        effective_role = payload.role or cur_role
        effective_loc = payload.location.strip() if (payload.location is not None and payload.location.strip()) else cur_loc

        # Check duplicate location for SITE_MANAGER in the same organisation
        if effective_role == "SITE_MANAGER" and effective_loc and target_org_id:
            cur.execute("""
                SELECT id FROM users
                WHERE organization_id = %s
                  AND role = 'SITE_MANAGER'
                  AND LOWER(TRIM(location)) = %s
                  AND id != %s
                  AND is_deleted IS NOT TRUE;
            """, (target_org_id, effective_loc.strip().lower(), user_id))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f'A site manager with location "{effective_loc.strip()}" already exists for this organisation. Location must be unique.'
                )
        if payload.email:
            normalized_email = payload.email.strip().lower()
            cur.execute("SELECT id FROM users WHERE LOWER(email) = %s AND id != %s;", (normalized_email, user_id))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'An account with email "{normalized_email}" is already registered. Email must be unique.'
                )
            cur.execute("UPDATE users SET email = %s WHERE id = %s;", (normalized_email, user_id))

        cur.execute("""
            UPDATE users
            SET first_name = COALESCE(%s, first_name),
                last_name = %s,
                role = COALESCE(%s, role),
                phone_number = %s,
                location = %s,
                password_hash = COALESCE(%s, password_hash),
                is_active = COALESCE(%s, is_active),
                updated_by = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, organization_id, email, first_name, last_name, role, phone_number, location, is_active, last_login_at, created_at, updated_at;
        """, (
            payload.first_name.strip() if payload.first_name is not None else None,
            payload.last_name.strip() if payload.last_name is not None else '',
            payload.role,
            payload.phone_number.strip() if payload.phone_number else None,
            payload.location.strip() if payload.location else None,
            pw_hash,
            payload.is_active,
            updater_id,
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
            cur.execute("SELECT company_name, organisation_code FROM organizations WHERE id = %s;", (d["organization_id"],))
            org_row = cur.fetchone()
            if org_row:
                d["company_name"] = org_row[0]
                d["organisation_code"] = org_row[1]
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

    deleter_id = current_user.get("id")

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE users
            SET is_deleted = TRUE,
                deleted_at = CURRENT_TIMESTAMP,
                deleted_by = %s,
                is_active = FALSE
            WHERE id = %s AND is_deleted IS NOT TRUE
            RETURNING id, email, first_name, last_name;
        """, (deleter_id, user_id))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return {"message": "User deleted successfully.", "id": str(row[0]), "email": row[1]}

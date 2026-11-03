import secrets
from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends, Query
from ..database import get_db_cursor
from ..schemas import (
    InvitationCreateRequest,
    InvitationResponse,
    VerifyInvitationResponse,
    AcceptInvitationRequest,
    LoginResponse,
    UserResponse,
)
from ..auth import get_current_user, get_password_hash, create_access_token
from ..email_service import send_user_invitation_email

router = APIRouter(prefix="/api", tags=["Invitations"])

# Send invitations to prospective client users
@router.post("/organizations/{org_id}/invitations")
def send_organization_invitations(
    org_id: str,
    payload: InvitationCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    user_role = current_user.get("role")
    user_org_id = current_user.get("organization_id")
    user_site_id = current_user.get("site_id")

    # Access control for invitation dispatching across the 4-level hierarchy
    if user_role == "OEM_MANAGER":
        pass
    elif user_role in ("ORGANISATION_OWNER", "SITE_ADMIN"):
        if user_org_id != org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot invite users to other client organizations."
            )
    elif user_role == "SITE_MANAGER":
        if user_org_id != org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot invite users to other client organizations."
            )
        for item in payload.invitations:
            if item.role != "OPERATOR":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Site Managers can only invite Operators."
                )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Operators do not have permission to invite users."
        )

    if not payload.invitations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one invitation email must be provided."
        )

    # Organisation owner single-seat and role validation
    owner_invites = [item for item in payload.invitations if item.role == "ORGANISATION_OWNER"]
    if owner_invites:
        if user_role != "OEM_MANAGER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only OEM Managers are authorized to invite an Organisation Owner."
            )
        if len(owner_invites) > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only one Organisation Owner can be invited per client organization."
            )

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, company_name FROM organizations WHERE id = %s AND is_deleted IS NOT TRUE;", (org_id,))
        org_row = cur.fetchone()
        if not org_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
        company_name = org_row[1]

        # Verify active or pending owner before sending invite
        if owner_invites:
            target_owner_email = owner_invites[0].email.strip().lower()

            cur.execute("""
                SELECT id, email, first_name, last_name, role
                FROM users
                WHERE organization_id = %s
                  AND role IN ('ORGANISATION_OWNER', 'SITE_ADMIN')
                  AND is_active = TRUE
                  AND (is_deleted IS NOT TRUE)
                LIMIT 1;
            """, (org_id,))
            existing_owner = cur.fetchone()
            if existing_owner:
                owner_email_label = existing_owner[1]
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"This client organization already has an assigned Organisation Owner ({owner_email_label}). Each client can only have one Organisation Owner."
                )

            cur.execute("""
                SELECT id, email, expires_at
                FROM user_invitations
                WHERE organization_id = %s
                  AND role IN ('ORGANISATION_OWNER', 'SITE_ADMIN')
                  AND status = 'PENDING'
                  AND expires_at > CURRENT_TIMESTAMP;
            """, (org_id,))
            pending_owners = cur.fetchall()
            for p_id, p_email, p_expires in pending_owners:
                if p_email.strip().lower() != target_owner_email:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"An Organisation Owner invitation is already pending for {p_email}. Each client can only have one Organisation Owner."
                    )

        inviter_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip()
        results = []
        errors = []

        for item in payload.invitations:
            clean_email = item.email.strip().lower()

            cur.execute("SELECT id, organization_id, is_active FROM users WHERE LOWER(email) = %s;", (clean_email,))
            existing_user = cur.fetchone()
            if existing_user and existing_user[2]:
                errors.append(f"{clean_email} is already an active user in the system.")
                continue

            cur.execute("""
                UPDATE user_invitations
                SET status = 'REVOKED'
                WHERE organization_id = %s AND LOWER(email) = %s AND status = 'PENDING';
            """, (org_id, clean_email))

            token = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc) + timedelta(days=7)

            site_target_id = item.site_id or (user_site_id if user_role == "SITE_MANAGER" else None)
            if site_target_id:
                cur.execute("SELECT id FROM sites WHERE id = %s AND organization_id = %s;", (site_target_id, org_id))
                if not cur.fetchone():
                    errors.append(f"Specified site is invalid for {clean_email}.")
                    continue

            cur.execute("""
                INSERT INTO user_invitations (
                    organization_id, site_id, email, role, token, status, expires_at, created_by
                ) VALUES (
                    %s, %s, %s, %s, %s, 'PENDING', %s, %s
                ) RETURNING id, organization_id, site_id, email, role, token, status, expires_at, created_at;
            """, (
                org_id,
                site_target_id,
                clean_email,
                item.role,
                token,
                expires_at,
                current_user.get("id")
            ))
            row = cur.fetchone()
            cols = [desc[0] for desc in cur.description]
            invite_dict = dict(zip(cols, row))
            invite_dict["id"] = str(invite_dict["id"])
            invite_dict["organization_id"] = str(invite_dict["organization_id"])
            if invite_dict.get("site_id"):
                invite_dict["site_id"] = str(invite_dict["site_id"])
            invite_dict["token"] = token

            email_res = send_user_invitation_email(
                to_email=clean_email,
                organization_name=company_name,
                role=item.role,
                token=token,
                inviter_name=inviter_name
            )

            invite_dict["email_sent"] = email_res.get("sent", False)
            results.append(invite_dict)

        if not results and errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="; ".join(errors)
            )

        return {
            "success": True,
            "invited_count": len(results),
            "invitations": results,
            "errors": errors if errors else None
        }

# List pending and past invitations for an organization
@router.get("/organizations/{org_id}/invitations")
def get_organization_invitations(
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_role = current_user.get("role")
    user_org_id = current_user.get("organization_id")
    if user_role != "OEM_MANAGER" and user_org_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You cannot view invitations for another organization."
        )

    with get_db_cursor() as cur:
        cur.execute("""
            SELECT i.id, i.organization_id, i.site_id, s.site_name, i.email, i.role, i.status, i.expires_at, i.created_at, i.accepted_at
            FROM user_invitations i
            LEFT JOIN sites s ON i.site_id = s.id
            WHERE i.organization_id = %s
            ORDER BY i.created_at DESC;
        """, (org_id,))
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        out = []
        for r in rows:
            d = dict(zip(cols, r))
            d["id"] = str(d["id"])
            d["organization_id"] = str(d["organization_id"])
            if d.get("site_id"):
                d["site_id"] = str(d["site_id"])
            out.append(d)
        return out

# Validate invitation token and return organization details
@router.get("/invitations/verify", response_model=VerifyInvitationResponse)
def verify_invitation(token: str = Query(..., description="Invitation token")):
    if not token or not token.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token parameter is required.")

    with get_db_cursor() as cur:
        cur.execute("""
            SELECT i.id, i.organization_id, i.site_id, s.site_name, i.email, i.role, i.status, i.expires_at,
                   o.company_name, o.client_code
            FROM user_invitations i
            JOIN organizations o ON i.organization_id = o.id
            LEFT JOIN sites s ON i.site_id = s.id
            WHERE i.token = %s;
        """, (token.strip(),))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invitation link or token not found.")

        invite_id, org_id, site_id, site_name, email, role, status_val, expires_at, company_name, client_code = row

        if status_val == "ACCEPTED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation has already been accepted. Please sign in.")

        if status_val == "REVOKED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation has been revoked or replaced with a newer invite.")

        now_utc = datetime.now(timezone.utc)
        if expires_at and expires_at < now_utc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation link has expired. Please ask your administrator to send a new invite.")

        return VerifyInvitationResponse(
            valid=True,
            email=email,
            role=role,
            organization_id=str(org_id),
            site_id=str(site_id) if site_id else None,
            site_name=site_name,
            company_name=company_name,
            client_code=client_code
        )

# Accept invitation, create password hash, and establish session
@router.post("/invitations/accept", response_model=LoginResponse)
def accept_invitation(payload: AcceptInvitationRequest):
    token = payload.token.strip()
    first_name = payload.first_name.strip()
    last_name = payload.last_name.strip()
    password = payload.password.strip()

    if not first_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="First name is required.")
    if not last_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Last name is required.")
    if len(password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters.")

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            SELECT i.id, i.organization_id, i.site_id, i.email, i.role, i.status, i.expires_at,
                   o.company_name, o.client_code
            FROM user_invitations i
            JOIN organizations o ON i.organization_id = o.id
            WHERE i.token = %s;
        """, (token,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invitation token.")

        invite_id, org_id, site_id, email, role, status_val, expires_at, company_name, client_code = row

        if status_val == "ACCEPTED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation has already been accepted.")

        if status_val == "REVOKED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation has been revoked.")

        now_utc = datetime.now(timezone.utc)
        if expires_at and expires_at < now_utc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invitation link has expired.")

        # Single owner guard on invitation acceptance
        if role in ("ORGANISATION_OWNER", "SITE_ADMIN"):
            cur.execute("""
                SELECT id, email FROM users
                WHERE organization_id = %s
                  AND role IN ('ORGANISATION_OWNER', 'SITE_ADMIN')
                  AND is_active = TRUE
                  AND (is_deleted IS NOT TRUE)
                  AND LOWER(email) != %s
                LIMIT 1;
            """, (org_id, email.lower()))
            clash = cur.fetchone()
            if clash:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"An Organisation Owner ({clash[1]}) is already registered for this organization."
                )

        pw_hash = get_password_hash(password)
        phone = payload.phone_number.strip() if payload.phone_number else None

        cur.execute("SELECT id FROM users WHERE LOWER(email) = %s;", (email.lower(),))
        existing_user = cur.fetchone()

        if existing_user:
            user_id = str(existing_user[0])
            cur.execute("""
                UPDATE users
                SET organization_id = %s,
                    site_id = COALESCE(%s, site_id),
                    password_hash = %s,
                    first_name = %s,
                    last_name = %s,
                    role = %s,
                    phone_number = COALESCE(%s, phone_number),
                    is_active = TRUE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING id, organization_id, site_id, email, first_name, last_name, role, phone_number, is_active, last_login_at, created_at, updated_at;
            """, (org_id, site_id, pw_hash, first_name, last_name, role, phone, user_id))
        else:
            cur.execute("""
                INSERT INTO users (
                    organization_id, site_id, email, password_hash, first_name, last_name, role, phone_number, is_active
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, TRUE
                )
                RETURNING id, organization_id, site_id, email, first_name, last_name, role, phone_number, is_active, last_login_at, created_at, updated_at;
            """, (org_id, site_id, email.lower(), pw_hash, first_name, last_name, role, phone))

        user_row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        user_dict = dict(zip(cols, user_row))
        user_dict["id"] = str(user_dict["id"])
        user_dict["organization_id"] = str(user_dict["organization_id"])
        if user_dict.get("site_id"):
            user_dict["site_id"] = str(user_dict["site_id"])
        user_dict["company_name"] = company_name
        user_dict["client_code"] = client_code

        cur.execute("""
            UPDATE user_invitations
            SET status = 'ACCEPTED', accepted_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (invite_id,))

        auth_token = create_access_token({
            "id": user_dict["id"],
            "sub": user_dict["id"],
            "email": user_dict["email"],
            "role": user_dict["role"],
            "organization_id": user_dict["organization_id"],
            "site_id": user_dict.get("site_id"),
            "company_name": company_name,
            "client_code": client_code
        })

        return LoginResponse(
            token=auth_token,
            user=UserResponse(**user_dict)
        )


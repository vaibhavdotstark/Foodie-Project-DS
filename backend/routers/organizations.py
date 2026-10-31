from datetime import datetime, date
import re
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from ..database import get_db_cursor
from ..schemas import OrganizationCreate, OrganizationUpdate, OrganizationResponse, BulkDeleteRequest
from ..auth import get_current_user, get_password_hash

router = APIRouter(prefix="/api/organizations", tags=["Organizations"], dependencies=[Depends(get_current_user)])

@router.get("/next-code")
def get_next_client_code():
    """Calculates the next sequential client code in CL-0001 series, preserving series order and never reusing any deleted or existing client ID."""
    with get_db_cursor() as cur:
        cur.execute("SELECT client_code FROM organizations;")
        rows = cur.fetchall()
        nums = set()
        for (code,) in rows:
            if not code:
                continue
            m = re.match(r'^CL-(\d+)', code.strip(), re.IGNORECASE)
            if m:
                try:
                    num = int(m.group(1))
                    if num < 9000:
                        nums.add(num)
                except ValueError:
                    continue
        next_num = max(nums) + 1 if nums else 1
        return {"next_code": f"CL-{next_num:04d}"}

@router.get("", response_model=List[OrganizationResponse])
def get_organizations():
    with get_db_cursor() as cur:
        cur.execute("SELECT * FROM organizations WHERE is_deleted IS NOT TRUE ORDER BY created_at DESC, client_code DESC;")
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        results = []
        for r in rows:
            d = dict(zip(cols, r))
            d["id"] = str(d["id"])
            if d.get("created_by"):
                d["created_by"] = str(d["created_by"])
            if d.get("deleted_by"):
                d["deleted_by"] = str(d["deleted_by"])
            if d.get("onboarding_date"):
                d["onboarding_date"] = str(d["onboarding_date"])
            results.append(OrganizationResponse(**d))
        return results

@router.get("/{org_id}", response_model=OrganizationResponse)
def get_organization(org_id: str):
    with get_db_cursor() as cur:
        cur.execute("SELECT * FROM organizations WHERE id = %s AND is_deleted IS NOT TRUE;", (org_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client organization not found.")
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        if d.get("created_by"):
            d["created_by"] = str(d["created_by"])
        if d.get("deleted_by"):
            d["deleted_by"] = str(d["deleted_by"])
        if d.get("onboarding_date"):
            d["onboarding_date"] = str(d["onboarding_date"])
        return OrganizationResponse(**d)

@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(payload: OrganizationCreate, current_user: dict = Depends(get_current_user)):
    code = payload.client_code.strip().upper()
    company = payload.company_name.strip()
    
    # Safe date sanitization
    onboarding_d = payload.onboarding_date.strip() if payload.onboarding_date and payload.onboarding_date.strip() else None

    with get_db_cursor(commit=True) as cur:
        # Check uniqueness of client_code across all records (including archived/deleted)
        cur.execute("SELECT id, is_deleted FROM organizations WHERE UPPER(client_code) = %s;", (code,))
        row = cur.fetchone()
        if row:
            if row[1]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Client ID '{code}' was previously assigned to an archived client and cannot be reused. Please use the next sequential code."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Client Code '{code}' is already registered."
                )

        # Check uniqueness of company_name
        cur.execute("SELECT id FROM organizations WHERE LOWER(company_name) = %s AND is_deleted IS NOT TRUE;", (company.lower(),))
        if cur.fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Company name '{company}' is already registered.")

        cur.execute("""
            INSERT INTO organizations (
                client_code, company_name, business_type, status, onboarding_date, tax_id, contact_poc, email, phone_number,
                website, billing_address, shipping_address, payment_terms, preferred_currency, comms_preference, is_active,
                created_by
            ) VALUES (
                %s, %s, %s, %s, COALESCE(%s::DATE, CURRENT_DATE), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s
            ) RETURNING *;
        """, (
            code,
            company,
            payload.business_type or 'Corporate',
            payload.status or 'Active',
            onboarding_d,
            payload.tax_id.strip() if payload.tax_id else None,
            payload.contact_poc.strip() if payload.contact_poc else None,
            payload.email.strip() if payload.email else None,
            payload.phone_number.strip() if payload.phone_number else None,
            payload.website.strip() if payload.website else None,
            payload.billing_address.strip() if payload.billing_address else None,
            (payload.shipping_address or payload.billing_address or '').strip() or None,
            payload.payment_terms or '30 days',
            payload.preferred_currency or 'AUD',
            payload.comms_preference or 'Email',
            payload.is_active if payload.is_active is not None else True,
            current_user.get("id")
        ))

        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        new_org_id = str(d["id"])
        d["id"] = new_org_id
        if d.get("created_by"):
            d["created_by"] = str(d["created_by"])
        if d.get("deleted_by"):
            d["deleted_by"] = str(d["deleted_by"])
        if d.get("onboarding_date"):
            d["onboarding_date"] = str(d["onboarding_date"])

        # Automatically create or link client login user account with default password '12345'
        if payload.email and payload.email.strip():
            clean_email = payload.email.strip().lower()
            cur.execute("SELECT id FROM users WHERE LOWER(email) = %s;", (clean_email,))
            existing_user = cur.fetchone()
            pw_hash = get_password_hash("12345")
            poc_name = (payload.contact_poc or payload.company_name or "Client Admin").strip()
            name_parts = poc_name.split(maxsplit=1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            if existing_user:
                cur.execute("""
                    UPDATE users
                    SET organization_id = %s,
                        password_hash = %s,
                        role = 'SITE_ADMIN',
                        is_active = TRUE
                    WHERE id = %s;
                """, (new_org_id, pw_hash, existing_user[0]))
            else:
                cur.execute("""
                    INSERT INTO users (
                        organization_id, email, password_hash, first_name, last_name, role, phone_number, is_active
                    ) VALUES (
                        %s, %s, %s, %s, %s, 'SITE_ADMIN', %s, TRUE
                    );
                """, (
                    new_org_id,
                    clean_email,
                    pw_hash,
                    first_name,
                    last_name,
                    payload.phone_number.strip() if payload.phone_number else None
                ))

        # Assign machines and create leases if specified in payload
        if payload.assigned_machines:
            for m in payload.assigned_machines:
                if m.machine_id and m.machine_id.strip():
                    m_ident = m.machine_id.strip()
                    loc = m.location.strip() if m.location and m.location.strip() else None
                    l_start = m.lease_start_date.strip() if m.lease_start_date and m.lease_start_date.strip() else None
                    l_end = m.lease_end_date.strip() if m.lease_end_date and m.lease_end_date.strip() else None

                    # Parse or default start date
                    try:
                        start_dt = datetime.strptime(l_start, "%Y-%m-%d").date() if l_start else date.today()
                    except ValueError:
                        start_dt = date.today()
                    l_start_str = start_dt.strftime("%Y-%m-%d")

                    # Calculate 5 years later if end date is missing or empty
                    if not l_end:
                        try:
                            end_dt = start_dt.replace(year=start_dt.year + 5)
                        except ValueError:
                            end_dt = start_dt.replace(month=2, day=28, year=start_dt.year + 5)
                        l_end_str = end_dt.strftime("%Y-%m-%d")
                    else:
                        try:
                            parsed_end = datetime.strptime(l_end, "%Y-%m-%d").date()
                            if parsed_end < start_dt:
                                raise HTTPException(
                                    status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Lease end date ({l_end}) cannot be earlier than lease start date ({l_start_str})."
                                )
                            l_end_str = parsed_end.strftime("%Y-%m-%d")
                        except ValueError:
                            try:
                                end_dt = start_dt.replace(year=start_dt.year + 5)
                            except ValueError:
                                end_dt = start_dt.replace(month=2, day=28, year=start_dt.year + 5)
                            l_end_str = end_dt.strftime("%Y-%m-%d")

                    # Find machine id
                    cur.execute("SELECT id FROM machines WHERE id::text = %s OR machine_code = %s OR serial_number = %s;", (m_ident, m_ident, m_ident))
                    m_row = cur.fetchone()
                    if m_row:
                        mach_uuid = m_row[0]
                        cur.execute("""
                            UPDATE machines
                            SET organization_id = %s,
                                location_label = COALESCE(%s, location_label)
                            WHERE id = %s;
                        """, (new_org_id, loc, mach_uuid))

                        # Create machine lease record
                        lease_ref = f"LSE-{code}-{m_ident[:4]}"
                        cur.execute("""
                            INSERT INTO machine_leases (
                                machine_id, organization_id, location_label,
                                lease_start_date, lease_end_date, lease_status, lease_reference
                            ) VALUES (
                                %s, %s, %s,
                                %s::DATE, %s::DATE, 'Active', %s
                            ) ON CONFLICT (lease_reference) DO UPDATE
                            SET organization_id = EXCLUDED.organization_id,
                                location_label = EXCLUDED.location_label,
                                lease_start_date = EXCLUDED.lease_start_date,
                                lease_end_date = EXCLUDED.lease_end_date,
                                lease_status = 'Active';
                        """, (mach_uuid, new_org_id, loc, l_start_str, l_end_str, lease_ref))

        return OrganizationResponse(**d)

@router.put("/{org_id}", response_model=OrganizationResponse)
def update_organization(org_id: str, payload: OrganizationUpdate):
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided for update.")

    set_clauses = []
    params = []
    for k, v in update_data.items():
        if k == 'onboarding_date':
            if not v or not str(v).strip():
                set_clauses.append("onboarding_date = NULL")
            else:
                set_clauses.append("onboarding_date = %s::DATE")
                params.append(str(v).strip())
        else:
            set_clauses.append(f"{k} = %s")
            params.append(v)
    params.append(org_id)

    with get_db_cursor(commit=True) as cur:
        cur.execute(f"""
            UPDATE organizations
            SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *;
        """, tuple(params))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client organization not found.")
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        if d.get("created_by"):
            d["created_by"] = str(d["created_by"])
        if d.get("deleted_by"):
            d["deleted_by"] = str(d["deleted_by"])
        if d.get("onboarding_date"):
            d["onboarding_date"] = str(d["onboarding_date"])
        return OrganizationResponse(**d)

@router.delete("/{org_id}", status_code=status.HTTP_200_OK)
def delete_organization(org_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can delete client organizations."
        )
    with get_db_cursor(commit=True) as cur:
        # Unmap machines assigned to this client (retaining machines in fleet inventory as available)
        cur.execute("UPDATE machines SET organization_id = NULL WHERE organization_id = %s;", (org_id,))
        # Update leases in machine_leases
        cur.execute("UPDATE machine_leases SET lease_status = 'Terminated' WHERE organization_id = %s;", (org_id,))
        # Unmap users assigned to this client
        cur.execute("UPDATE users SET organization_id = NULL WHERE organization_id = %s;", (org_id,))
        # Soft delete: flagged as deleted in PostgreSQL while preserving original client_code
        cur.execute("""
            UPDATE organizations
            SET is_deleted = TRUE,
                deleted_at = CURRENT_TIMESTAMP,
                deleted_by = %s,
                is_active = FALSE,
                status = 'Archived'
            WHERE id = %s;
        """, (current_user.get("id"), org_id))
        return {"success": True, "message": "Client organization deleted successfully and machines unassigned.", "id": org_id}

@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
def bulk_delete_organizations(payload: BulkDeleteRequest, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can perform bulk deletion."
        )
    if not payload.ids:
        return {"message": "No organizations provided", "deleted_count": 0}
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE machines
            SET organization_id = NULL
            WHERE organization_id::text = ANY(%s);
        """, (payload.ids,))
        cur.execute("""
            UPDATE machine_leases
            SET lease_status = 'Terminated'
            WHERE organization_id::text = ANY(%s);
        """, (payload.ids,))
        cur.execute("""
            UPDATE users
            SET organization_id = NULL
            WHERE organization_id::text = ANY(%s);
        """, (payload.ids,))
        cur.execute("""
            UPDATE organizations
            SET is_deleted = TRUE,
                deleted_at = CURRENT_TIMESTAMP,
                deleted_by = %s,
                is_active = FALSE,
                status = 'Archived'
            WHERE id::text = ANY(%s)
            RETURNING id;
        """, (current_user.get("id"), payload.ids))
        deleted_ids = [str(r[0]) for r in cur.fetchall()]
        return {"message": f"Successfully deleted {len(deleted_ids)} client(s).", "deleted_ids": deleted_ids}


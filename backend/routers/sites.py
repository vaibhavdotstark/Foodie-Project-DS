from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from ..database import get_db_cursor
from ..schemas import SiteCreate, SiteUpdate, SiteResponse
from ..auth import get_current_user

router = APIRouter(prefix="/api/sites", tags=["Sites"], dependencies=[Depends(get_current_user)])

# Query sites with tenant-based isolation
@router.get("", response_model=List[SiteResponse])
def get_all_sites(
    organization_id: Optional[str] = Query(None, description="Filter by client organization"),
    current_user: dict = Depends(get_current_user)
):
    user_role = current_user.get("role")
    user_org_id = current_user.get("organization_id")
    user_site_id = current_user.get("site_id")

    with get_db_cursor() as cur:
        # OEM Manager can view all or filter by org
        if user_role == "OEM_MANAGER":
            if organization_id:
                cur.execute(
                    "SELECT * FROM sites WHERE organization_id = %s ORDER BY site_code ASC;",
                    (organization_id,)
                )
            else:
                cur.execute("SELECT * FROM sites ORDER BY site_code ASC;")
        # Organisation Owner sees all sites within their own organization
        elif user_role in ("ORGANISATION_OWNER", "SITE_ADMIN"):
            cur.execute(
                "SELECT * FROM sites WHERE organization_id = %s ORDER BY site_code ASC;",
                (user_org_id,)
            )
        # Site Manager and Operator are scoped strictly to their assigned site
        else:
            if not user_site_id:
                return []
            cur.execute(
                "SELECT * FROM sites WHERE id = %s AND organization_id = %s ORDER BY site_code ASC;",
                (user_site_id, user_org_id)
            )

        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        results = []
        for r in rows:
            d = dict(zip(cols, r))
            d["id"] = str(d["id"])
            d["organization_id"] = str(d["organization_id"])
            results.append(SiteResponse(**d))
        return results

# Create a new physical site under an organization
@router.post("", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
def create_site(
    payload: SiteCreate,
    current_user: dict = Depends(get_current_user)
):
    user_role = current_user.get("role")
    user_org_id = current_user.get("organization_id")

    # Access control: OEM or Org Owner of this organization
    if user_role != "OEM_MANAGER":
        if user_role not in ("ORGANISATION_OWNER", "SITE_ADMIN") or user_org_id != payload.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot create sites for other organizations."
            )

    normalized_code = payload.site_code.strip().upper()

    with get_db_cursor(commit=True) as cur:
        # Check uniqueness within the organization
        cur.execute(
            "SELECT id FROM sites WHERE organization_id = %s AND UPPER(site_code) = %s;",
            (payload.organization_id, normalized_code)
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'Site code "{normalized_code}" is already registered in this organization.'
            )

        cur.execute("""
            INSERT INTO sites (organization_id, site_code, site_name, address, timezone, is_active)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *;
        """, (
            payload.organization_id,
            normalized_code,
            payload.site_name.strip(),
            payload.address.strip(),
            payload.timezone or 'Australia/Adelaide',
            payload.is_active if payload.is_active is not None else True
        ))
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        d["organization_id"] = str(d["organization_id"])
        return SiteResponse(**d)

# Update site details with tenant verification
@router.put("/{site_id}", response_model=SiteResponse)
def update_site(
    site_id: str,
    payload: SiteUpdate,
    current_user: dict = Depends(get_current_user)
):
    user_role = current_user.get("role")
    user_org_id = current_user.get("organization_id")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT organization_id FROM sites WHERE id = %s;", (site_id,))
        site_row = cur.fetchone()
        if not site_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found.")

        # Ensure non-OEM users can only update sites in their own organization
        if user_role != "OEM_MANAGER":
            if user_role not in ("ORGANISATION_OWNER", "SITE_ADMIN") or str(site_row[0]) != str(user_org_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not have permission to modify this site."
                )

        cur.execute("""
            UPDATE sites
            SET site_name = COALESCE(%s, site_name),
                address = COALESCE(%s, address),
                timezone = COALESCE(%s, timezone),
                is_active = COALESCE(%s, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *;
        """, (
            payload.site_name.strip() if payload.site_name else None,
            payload.address.strip() if payload.address else None,
            payload.timezone,
            payload.is_active,
            site_id
        ))
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        d["organization_id"] = str(d["organization_id"])
        return SiteResponse(**d)

# Delete site record
@router.delete("/{site_id}")
def delete_site(
    site_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_role = current_user.get("role")
    user_org_id = current_user.get("organization_id")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT organization_id FROM sites WHERE id = %s;", (site_id,))
        site_row = cur.fetchone()
        if not site_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found.")

        if user_role != "OEM_MANAGER":
            if user_role not in ("ORGANISATION_OWNER", "SITE_ADMIN") or str(site_row[0]) != str(user_org_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not have permission to delete this site."
                )

        cur.execute("DELETE FROM sites WHERE id = %s RETURNING id, site_code, site_name;", (site_id,))
        row = cur.fetchone()
        return {"message": "Site deleted successfully.", "id": str(row[0]), "site_code": row[1]}

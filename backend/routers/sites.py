from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from ..database import get_db_cursor
from ..schemas import SiteCreate, SiteUpdate, SiteResponse
from ..auth import get_current_user

router = APIRouter(prefix="/api/sites", tags=["Sites"], dependencies=[Depends(get_current_user)])

@router.get("", response_model=List[SiteResponse])
def get_all_sites():
    with get_db_cursor() as cur:
        cur.execute("SELECT * FROM sites ORDER BY site_code ASC;")
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        results = []
        for r in rows:
            d = dict(zip(cols, r))
            d["id"] = str(d["id"])
            d["organization_id"] = str(d["organization_id"])
            results.append(SiteResponse(**d))
        return results

@router.post("", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
def create_site(payload: SiteCreate):
    normalized_code = payload.site_code.strip().upper()

    with get_db_cursor(commit=True) as cur:
        # Check uniqueness constraint
        cur.execute(
            "SELECT id FROM sites WHERE organization_id = %s AND UPPER(site_code) = %s;",
            (payload.organization_id, normalized_code)
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'Site code "{normalized_code}" is already registered. Site codes must be unique.'
            )

        cur.execute("""
            INSERT INTO sites (organization_id, site_code, site_name, address, latitude, longitude, timezone, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *;
        """, (
            payload.organization_id,
            normalized_code,
            payload.site_name.strip(),
            payload.address.strip(),
            payload.latitude,
            payload.longitude,
            payload.timezone or 'Australia/Adelaide',
            payload.is_active if payload.is_active is not None else True
        ))
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        d["organization_id"] = str(d["organization_id"])
        return SiteResponse(**d)

@router.put("/{site_id}", response_model=SiteResponse)
def update_site(site_id: str, payload: SiteUpdate):
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE sites
            SET site_name = COALESCE(%s, site_name),
                address = COALESCE(%s, address),
                latitude = COALESCE(%s, latitude),
                longitude = COALESCE(%s, longitude),
                timezone = COALESCE(%s, timezone),
                is_active = COALESCE(%s, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *;
        """, (
            payload.site_name.strip() if payload.site_name else None,
            payload.address.strip() if payload.address else None,
            payload.latitude,
            payload.longitude,
            payload.timezone,
            payload.is_active,
            site_id
        ))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found.")

        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        d["organization_id"] = str(d["organization_id"])
        return SiteResponse(**d)

@router.delete("/{site_id}")
def delete_site(site_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can delete sites."
        )
    with get_db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM sites WHERE id = %s RETURNING id, site_code, site_name;", (site_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found.")
        return {"message": "Site deleted successfully.", "id": str(row[0]), "site_code": row[1]}

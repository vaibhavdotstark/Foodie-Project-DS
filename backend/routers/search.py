from fastapi import APIRouter, Query, Depends
from typing import List
from ..database import get_db_cursor
from ..schemas import (
    SearchResponse,
    SearchResultItemOrganization,
    SearchResultItemSite,
    SearchResultItemUser,
    SearchResultItemMachine
)
from ..auth import get_current_user

router = APIRouter(prefix="/api/search", tags=["Global Search"])

@router.get("", response_model=SearchResponse)
def search_entities(
    q: str = Query("", description="Search term for organizations, sites, users, machines"),
    current_user: dict = Depends(get_current_user)
):
    query = q.strip()
    if not query:
        return SearchResponse(organizations=[], sites=[], users=[], machines=[])

    search_pattern = f"%{query}%"
    role = (current_user.get("role") or "").upper()
    org_id = current_user.get("organization_id")
    site_id = current_user.get("site_id")
    user_location = (current_user.get("location") or "").strip()

    organizations = []
    sites = []
    users = []
    machines = []

    with get_db_cursor() as cur:
        # 1. Organizations Search
        # OEM_MANAGER can search all organizations.
        # ORGANISATION_OWNER / SITE_ADMIN / SITE_MANAGER can only search their own organization.
        # OPERATOR does not view organizations.
        if role == "OEM_MANAGER":
            cur.execute("""
                SELECT id, organisation_code, company_name, business_type, status, email
                FROM organizations
                WHERE is_deleted IS NOT TRUE
                  AND (
                    organisation_code ILIKE %s
                    OR company_name ILIKE %s
                    OR email ILIKE %s
                  )
                ORDER BY company_name ASC
                LIMIT 5;
            """, (search_pattern, search_pattern, search_pattern))
            for r in cur.fetchall():
                organizations.append(SearchResultItemOrganization(
                    id=str(r[0]),
                    organisation_code=r[1],
                    client_code=r[1],
                    company_name=r[2],
                    business_type=r[3],
                    status=r[4] or "Active",
                    email=r[5]
                ))
        elif role in ("ORGANISATION_OWNER", "SITE_ADMIN", "SITE_MANAGER") and org_id:
            cur.execute("""
                SELECT id, organisation_code, company_name, business_type, status, email
                FROM organizations
                WHERE id = %s
                  AND is_deleted IS NOT TRUE
                  AND (
                    organisation_code ILIKE %s
                    OR company_name ILIKE %s
                    OR email ILIKE %s
                  )
                LIMIT 1;
            """, (org_id, search_pattern, search_pattern, search_pattern))
            for r in cur.fetchall():
                organizations.append(SearchResultItemOrganization(
                    id=str(r[0]),
                    organisation_code=r[1],
                    client_code=r[1],
                    company_name=r[2],
                    business_type=r[3],
                    status=r[4] or "Active",
                    email=r[5]
                ))

        # 2. Machines Search
        # OEM_MANAGER: can search all machines
        # ORGANISATION_OWNER / SITE_ADMIN: only machines in their organization
        # SITE_MANAGER / OPERATOR: machines in their organization at their site/location
        if role == "OEM_MANAGER":
            cur.execute("""
                SELECT m.id, m.machine_code, m.serial_number, m.model, COALESCE(m.location_label, 'Fleet') AS location, m.connectivity_status
                FROM machines m
                WHERE m.is_deleted IS NOT TRUE
                  AND (
                    m.machine_code ILIKE %s
                    OR m.serial_number ILIKE %s
                    OR m.model ILIKE %s
                    OR m.location_label ILIKE %s
                  )
                ORDER BY m.machine_code ASC
                LIMIT 6;
            """, (search_pattern, search_pattern, search_pattern, search_pattern))
        elif role in ("ORGANISATION_OWNER", "SITE_ADMIN") and org_id:
            cur.execute("""
                SELECT m.id, m.machine_code, m.serial_number, m.model, COALESCE(m.location_label, 'Fleet') AS location, m.connectivity_status
                FROM machines m
                WHERE m.organization_id = %s
                  AND m.is_deleted IS NOT TRUE
                  AND (
                    m.machine_code ILIKE %s
                    OR m.serial_number ILIKE %s
                    OR m.model ILIKE %s
                    OR m.location_label ILIKE %s
                  )
                ORDER BY m.machine_code ASC
                LIMIT 6;
            """, (org_id, search_pattern, search_pattern, search_pattern, search_pattern))
        elif role in ("SITE_MANAGER", "OPERATOR") and org_id:
            if site_id and user_location:
                cur.execute("""
                    SELECT m.id, m.machine_code, m.serial_number, m.model, COALESCE(m.location_label, 'Fleet') AS location, m.connectivity_status
                    FROM machines m
                    WHERE m.organization_id = %s
                      AND m.is_deleted IS NOT TRUE
                      AND (m.site_id = %s OR m.location_label ILIKE %s)
                      AND (
                        m.machine_code ILIKE %s
                        OR m.serial_number ILIKE %s
                        OR m.model ILIKE %s
                        OR m.location_label ILIKE %s
                      )
                    ORDER BY m.machine_code ASC
                    LIMIT 6;
                """, (org_id, site_id, f"%{user_location}%", search_pattern, search_pattern, search_pattern, search_pattern))
            elif site_id:
                cur.execute("""
                    SELECT m.id, m.machine_code, m.serial_number, m.model, COALESCE(m.location_label, 'Fleet') AS location, m.connectivity_status
                    FROM machines m
                    WHERE m.organization_id = %s
                      AND m.is_deleted IS NOT TRUE
                      AND m.site_id = %s
                      AND (
                        m.machine_code ILIKE %s
                        OR m.serial_number ILIKE %s
                        OR m.model ILIKE %s
                        OR m.location_label ILIKE %s
                      )
                    ORDER BY m.machine_code ASC
                    LIMIT 6;
                """, (org_id, site_id, search_pattern, search_pattern, search_pattern, search_pattern))
            elif user_location:
                cur.execute("""
                    SELECT m.id, m.machine_code, m.serial_number, m.model, COALESCE(m.location_label, 'Fleet') AS location, m.connectivity_status
                    FROM machines m
                    WHERE m.organization_id = %s
                      AND m.is_deleted IS NOT TRUE
                      AND m.location_label ILIKE %s
                      AND (
                        m.machine_code ILIKE %s
                        OR m.serial_number ILIKE %s
                        OR m.model ILIKE %s
                        OR m.location_label ILIKE %s
                      )
                    ORDER BY m.machine_code ASC
                    LIMIT 6;
                """, (org_id, f"%{user_location}%", search_pattern, search_pattern, search_pattern, search_pattern))
            else:
                cur.execute("""
                    SELECT m.id, m.machine_code, m.serial_number, m.model, COALESCE(m.location_label, 'Fleet') AS location, m.connectivity_status
                    FROM machines m
                    WHERE m.organization_id = %s
                      AND m.is_deleted IS NOT TRUE
                      AND (
                        m.machine_code ILIKE %s
                        OR m.serial_number ILIKE %s
                        OR m.model ILIKE %s
                        OR m.location_label ILIKE %s
                      )
                    ORDER BY m.machine_code ASC
                    LIMIT 6;
                """, (org_id, search_pattern, search_pattern, search_pattern, search_pattern))
        else:
            cur.execute("SELECT 1 WHERE 1=0;")

        machine_rows = cur.fetchall()
        for r in machine_rows:
            machines.append(SearchResultItemMachine(
                id=str(r[0]),
                machine_code=r[1],
                serial_number=r[2],
                model=r[3],
                location=r[4],
                status=r[5] or "Offline",
                temp="62°C"
            ))

        # 3. Users Search
        # OEM_MANAGER can search all users.
        # ORGANISATION_OWNER / SITE_ADMIN / SITE_MANAGER: only users within their organization (not OEM).
        # OPERATOR: cannot search other users.
        if role == "OEM_MANAGER":
            cur.execute("""
                SELECT id, first_name, last_name, email, role, phone_number, location
                FROM users
                WHERE is_deleted IS NOT TRUE
                  AND (
                    first_name ILIKE %s
                    OR last_name ILIKE %s
                    OR email ILIKE %s
                    OR phone_number ILIKE %s
                    OR (first_name || ' ' || last_name) ILIKE %s
                  )
                ORDER BY first_name ASC
                LIMIT 5;
            """, (search_pattern, search_pattern, search_pattern, search_pattern, search_pattern))
            for r in cur.fetchall():
                users.append(SearchResultItemUser(
                    id=str(r[0]),
                    first_name=r[1],
                    last_name=r[2],
                    email=r[3],
                    role=r[4],
                    phone_number=r[5],
                    location=r[6]
                ))
        elif role in ("ORGANISATION_OWNER", "SITE_ADMIN", "SITE_MANAGER") and org_id:
            cur.execute("""
                SELECT id, first_name, last_name, email, role, phone_number, location
                FROM users
                WHERE organization_id = %s
                  AND is_deleted IS NOT TRUE
                  AND role != 'OEM_MANAGER'
                  AND (
                    first_name ILIKE %s
                    OR last_name ILIKE %s
                    OR email ILIKE %s
                    OR phone_number ILIKE %s
                    OR (first_name || ' ' || last_name) ILIKE %s
                  )
                ORDER BY first_name ASC
                LIMIT 5;
            """, (org_id, search_pattern, search_pattern, search_pattern, search_pattern, search_pattern))
            for r in cur.fetchall():
                users.append(SearchResultItemUser(
                    id=str(r[0]),
                    first_name=r[1],
                    last_name=r[2],
                    email=r[3],
                    role=r[4],
                    phone_number=r[5],
                    location=r[6]
                ))

        # 4. Sites Search
        # OEM_MANAGER: can search all sites
        # ORGANISATION_OWNER / SITE_ADMIN: sites in their organization
        # SITE_MANAGER / OPERATOR: their assigned site
        if role == "OEM_MANAGER":
            cur.execute("""
                SELECT id, site_code, site_name, address, timezone, is_active
                FROM sites
                WHERE is_active IS TRUE
                  AND (site_code ILIKE %s OR site_name ILIKE %s OR address ILIKE %s)
                ORDER BY site_name ASC
                LIMIT 5;
            """, (search_pattern, search_pattern, search_pattern))
            for r in cur.fetchall():
                sites.append(SearchResultItemSite(
                    id=str(r[0]),
                    site_code=r[1],
                    site_name=r[2],
                    address=r[3] or "",
                    timezone=r[4] or "UTC+10:00",
                    is_active=bool(r[5])
                ))
        elif role in ("ORGANISATION_OWNER", "SITE_ADMIN") and org_id:
            cur.execute("""
                SELECT id, site_code, site_name, address, timezone, is_active
                FROM sites
                WHERE organization_id = %s
                  AND is_active IS TRUE
                  AND (site_code ILIKE %s OR site_name ILIKE %s OR address ILIKE %s)
                ORDER BY site_name ASC
                LIMIT 5;
            """, (org_id, search_pattern, search_pattern, search_pattern))
            for r in cur.fetchall():
                sites.append(SearchResultItemSite(
                    id=str(r[0]),
                    site_code=r[1],
                    site_name=r[2],
                    address=r[3] or "",
                    timezone=r[4] or "UTC+10:00",
                    is_active=bool(r[5])
                ))
        elif role in ("SITE_MANAGER", "OPERATOR") and site_id:
            cur.execute("""
                SELECT id, site_code, site_name, address, timezone, is_active
                FROM sites
                WHERE id = %s
                  AND is_active IS TRUE
                  AND (site_code ILIKE %s OR site_name ILIKE %s OR address ILIKE %s)
                LIMIT 1;
            """, (site_id, search_pattern, search_pattern, search_pattern))
            for r in cur.fetchall():
                sites.append(SearchResultItemSite(
                    id=str(r[0]),
                    site_code=r[1],
                    site_name=r[2],
                    address=r[3] or "",
                    timezone=r[4] or "UTC+10:00",
                    is_active=bool(r[5])
                ))

    return SearchResponse(organizations=organizations, sites=sites, users=users, machines=machines)

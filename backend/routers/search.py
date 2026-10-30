from fastapi import APIRouter, Query, Depends
from ..database import get_db_cursor
from ..schemas import SearchResponse, SearchResultItemSite, SearchResultItemUser, SearchResultItemMachine
from ..auth import get_current_user

router = APIRouter(prefix="/api/search", tags=["Global Search"], dependencies=[Depends(get_current_user)])

MACHINES_TELEMETRY = [
    {"id": "M12", "model": "Foodie F25", "location": "Site A — Prince Alfred College", "status": "Running", "temp": "62°C"},
    {"id": "M13", "model": "Foodie F100", "location": "Site B — Mount Isa Kitchen", "status": "Running", "temp": "65°C"},
    {"id": "M14", "model": "Foodie F25", "location": "Site C — Mawson Lakes", "status": "Idle", "temp": "45°C"},
    {"id": "M15", "model": "Foodie F100", "location": "Site F — Processing Center", "status": "Maintenance", "temp": "28°C"},
]

@router.get("", response_model=SearchResponse)
def search_entities(q: str = Query("", description="Search term for sites, users, machines")):
    query = q.strip()
    if not query:
        return SearchResponse(sites=[], users=[], machines=[])

    search_pattern = f"%{query}%"

    with get_db_cursor() as cur:
        # 1. Sites (Removed for sprint 1)
        sites = []

        # 2. Search Users
        cur.execute("""
            SELECT id, first_name, last_name, email, role, phone_number
            FROM users
            WHERE first_name ILIKE %s OR last_name ILIKE %s OR email ILIKE %s
            LIMIT 5;
        """, (search_pattern, search_pattern, search_pattern))
        user_rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        users = [SearchResultItemUser(**{**dict(zip(cols, r)), "id": str(r[0])}) for r in user_rows]

        # 3. Search Machines from PostgreSQL
        cur.execute("""
            SELECT m.machine_code, m.model, COALESCE(m.location_label, 'Fleet') AS location, m.connectivity_status
            FROM machines m
            WHERE m.machine_code ILIKE %s OR m.model ILIKE %s OR m.serial_number ILIKE %s OR m.location_label ILIKE %s
            LIMIT 5;
        """, (search_pattern, search_pattern, search_pattern, search_pattern))
        machine_rows = cur.fetchall()
        machines = [
            SearchResultItemMachine(
                id=r[0],
                model=r[1],
                location=r[2],
                status=r[3] or 'Offline',
                temp="62°C"
            ) for r in machine_rows
        ]

        return SearchResponse(sites=sites, users=users, machines=machines)

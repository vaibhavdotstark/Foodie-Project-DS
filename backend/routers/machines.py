from datetime import datetime, date
import re
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from ..database import get_db_cursor
from ..schemas import MachineCreate, MachineUpdate, MachineResponse, MachineModelResponse, VALID_MACHINE_MODELS
from ..auth import get_current_user

router = APIRouter(prefix="/api/machines", tags=["Machines"], dependencies=[Depends(get_current_user)])

SQL_SELECT_MACHINE_JOINED = """
    SELECT 
        m.id, m.machine_code, m.serial_number, m.model_id, m.model, m.capacity, m.hardware_version,
        m.organization_id, o.client_code, o.company_name,
        m.location_label, m.location_description,
        m.plc_software_version, m.energy_meter_model, m.deodor_model, m.extractor_model,
        COALESCE(m.has_stairs, false) AS has_stairs, m.notes,
        TO_CHAR(ml.lease_start_date, 'YYYY-MM-DD') AS lease_start_date,
        TO_CHAR(ml.lease_end_date, 'YYYY-MM-DD') AS lease_end_date,
        COALESCE(ml.lease_status, 'Available') AS lease_status,
        ml.lease_reference,
        m.connectivity_status, 
        COALESCE(m.operational_status, 'Idle') AS operational_status, m.is_active,
        m.created_by, m.deleted_by,
        m.created_at, m.updated_at
    FROM machines m
    LEFT JOIN organizations o ON m.organization_id = o.id
    LEFT JOIN machine_leases ml ON m.id = ml.machine_id AND ml.lease_status = 'Active'
"""

def row_to_machine_dict(cols, row) -> dict:
    d = dict(zip(cols, row))
    d["id"] = str(d["id"])
    if d.get("model_id"):
        d["model_id"] = str(d["model_id"])
    if d.get("organization_id"):
        d["organization_id"] = str(d["organization_id"])
    if d.get("created_by"):
        d["created_by"] = str(d["created_by"])
    if d.get("deleted_by"):
        d["deleted_by"] = str(d["deleted_by"])
    return d

@router.get("/next-code")
def get_next_machine_code():
    """Calculates the next sequential machine code in C001 series, preserving series order and never reusing any deleted or existing machine ID."""
    with get_db_cursor() as cur:
        cur.execute("SELECT machine_code, serial_number FROM machines;")
        rows = cur.fetchall()
        nums = set()
        for m_code, s_num in rows:
            for val in (m_code, s_num):
                if not val:
                    continue
                m = re.match(r'^C(\d+)', val.strip(), re.IGNORECASE)
                if m:
                    try:
                        num = int(m.group(1))
                        if num < 900:
                            nums.add(num)
                    except ValueError:
                        continue
        next_num = max(nums) + 1 if nums else 1
        return {"next_code": f"C{next_num:03d}"}

@router.get("/models", response_model=List[MachineModelResponse])
def get_machine_models():
    """Fetch all machine models dynamically in standard series order (F25, F100, F500, F1000)."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, model_code, display_name, capacity, is_active 
            FROM machine_models 
            ORDER BY 
                CASE model_code
                    WHEN 'F25' THEN 1
                    WHEN 'F100' THEN 2
                    WHEN 'F500' THEN 3
                    WHEN 'F1000' THEN 4
                    ELSE 5
                END ASC, 
                model_code ASC;
        """)
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        return [MachineModelResponse(**{**dict(zip(cols, r)), "id": str(r[0])}) for r in rows]

@router.get("", response_model=List[MachineResponse])
def get_all_machines(current_user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        if current_user.get("role") != "OEM_MANAGER" and current_user.get("organization_id"):
            cur.execute(
                f"{SQL_SELECT_MACHINE_JOINED} WHERE (m.is_deleted IS NOT TRUE) AND m.organization_id = %s ORDER BY m.machine_code ASC;",
                (current_user["organization_id"],)
            )
        else:
            cur.execute(f"{SQL_SELECT_MACHINE_JOINED} WHERE (m.is_deleted IS NOT TRUE) ORDER BY m.machine_code ASC;")
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        return [MachineResponse(**row_to_machine_dict(cols, r)) for r in rows]

@router.get("/{machine_id}", response_model=MachineResponse)
def get_machine(machine_id: str):
    with get_db_cursor() as cur:
        cur.execute(f"{SQL_SELECT_MACHINE_JOINED} WHERE m.id = %s AND (m.is_deleted IS NOT TRUE);", (machine_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Machine with ID '{machine_id}' not found."
            )
        cols = [desc[0] for desc in cur.description]
        return MachineResponse(**row_to_machine_dict(cols, row))

@router.post("", response_model=MachineResponse, status_code=status.HTTP_201_CREATED)
def create_machine(payload: MachineCreate, current_user: dict = Depends(get_current_user)):
    normalized_serial = payload.serial_number.strip().upper()
    raw_code = payload.machine_code or payload.serial_number
    normalized_code = raw_code.strip().upper()

    model_name = payload.model.strip()
    if model_name.upper() == 'F25':
        model_name = 'Foodie F25'
    elif model_name.upper() == 'F100':
        model_name = 'Foodie F100'
    elif model_name.upper() == 'F500':
        model_name = 'Foodie F500'
    elif model_name.upper() == 'F1000':
        model_name = 'Foodie F1000'

    # Do not prefill or default capacity until user inputs it
    capacity = payload.capacity.strip() if (payload.capacity and payload.capacity.strip()) else None

    with get_db_cursor(commit=True) as cur:
        # Check duplicate machine_code across all records (including archived/deleted)
        cur.execute("SELECT id, is_deleted FROM machines WHERE UPPER(machine_code) = %s;", (normalized_code,))
        row = cur.fetchone()
        if row:
            if row[1]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'Machine Code "{normalized_code}" was previously assigned to an archived machine and cannot be reused.'
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'Machine Code "{normalized_code}" is already registered. It must be unique.'
                )

        # Check duplicate serial_number across all records (including archived/deleted)
        cur.execute("SELECT id, is_deleted FROM machines WHERE UPPER(serial_number) = %s;", (normalized_serial,))
        row = cur.fetchone()
        if row:
            if row[1]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'Serial Number "{normalized_serial}" was previously assigned to an archived machine and cannot be reused.'
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'Serial Number "{normalized_serial}" is already registered. It must be unique.'
                )

        # Look up model_id from machine_models
        cur.execute("SELECT id FROM machine_models WHERE model_code = %s OR display_name = %s;", (payload.model.strip().upper(), model_name))
        model_row = cur.fetchone()
        resolved_model_id = model_row[0] if model_row else None

        cur.execute("""
            INSERT INTO machines (
                machine_code, serial_number, model_id, model, capacity, hardware_version,
                organization_id, location_label, location_description,
                plc_software_version, energy_meter_model, deodor_model, extractor_model,
                has_stairs, notes, connectivity_status, operational_status, is_active,
                created_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s
            ) RETURNING id;
        """, (
            normalized_code,
            normalized_serial,
            resolved_model_id,
            model_name,
            capacity,
            payload.hardware_version.strip() if (payload.hardware_version and payload.hardware_version.strip()) else None,
            payload.organization_id or None,
            payload.location_label.strip() if payload.location_label else None,
            payload.location_description.strip() if payload.location_description else None,
            payload.plc_software_version.strip() if payload.plc_software_version else None,
            payload.energy_meter_model.strip() if payload.energy_meter_model else None,
            payload.deodor_model.strip() if payload.deodor_model else None,
            payload.extractor_model.strip() if payload.extractor_model else None,
            bool(payload.has_stairs),
            payload.notes.strip() if payload.notes else None,
            payload.connectivity_status or 'Offline',
            payload.operational_status or 'Idle',
            True,
            current_user.get("id")
        ))
        new_id = cur.fetchone()[0]

        cur.execute(f"{SQL_SELECT_MACHINE_JOINED} WHERE m.id = %s;", (new_id,))
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        return MachineResponse(**row_to_machine_dict(cols, row))

@router.put("/{machine_id}", response_model=MachineResponse)
def update_machine(machine_id: str, payload: MachineUpdate):
    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, model, capacity FROM machines WHERE id = %s;", (machine_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Machine with ID '{machine_id}' not found."
            )

        if payload.serial_number:
            normalized_serial = payload.serial_number.strip().upper()
            cur.execute("SELECT id FROM machines WHERE UPPER(serial_number) = %s AND id != %s;", (normalized_serial, machine_id))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'Serial Number "{normalized_serial}" is already registered (or was previously used).'
                )

        capacity = payload.capacity
        model_name = payload.model

        if "organization_id" in payload.model_fields_set:
            cur.execute("UPDATE machines SET organization_id = %s WHERE id = %s;", (payload.organization_id, machine_id))
            if payload.organization_id is None:
                cur.execute("UPDATE machine_leases SET lease_status = 'Terminated' WHERE machine_id = %s AND lease_status = 'Active';", (machine_id,))
            else:
                l_start = payload.lease_start_date.strip() if payload.lease_start_date and payload.lease_start_date.strip() else None
                l_end = payload.lease_end_date.strip() if payload.lease_end_date and payload.lease_end_date.strip() else None
                try:
                    start_dt = datetime.strptime(l_start, "%Y-%m-%d").date() if l_start else date.today()
                except ValueError:
                    start_dt = date.today()
                l_start_str = start_dt.strftime("%Y-%m-%d")

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

                lease_ref = f"LSE-{machine_id[:8]}"
                cur.execute("""
                    INSERT INTO machine_leases (
                        machine_id, organization_id, location_label,
                        lease_start_date, lease_end_date, lease_status, lease_reference
                    ) VALUES (
                        %s, %s, %s,
                        %s::DATE, %s::DATE, 'Active', %s
                    ) ON CONFLICT (lease_reference) DO UPDATE
                    SET organization_id = EXCLUDED.organization_id,
                        location_label = COALESCE(EXCLUDED.location_label, machine_leases.location_label),
                        lease_start_date = EXCLUDED.lease_start_date,
                        lease_end_date = EXCLUDED.lease_end_date,
                        lease_status = 'Active';
                """, (machine_id, payload.organization_id, payload.location_label, l_start_str, l_end_str, lease_ref))

        cur.execute("""
            UPDATE machines SET
                serial_number = COALESCE(%s, serial_number),
                model = COALESCE(%s, model),
                capacity = COALESCE(%s, capacity),
                hardware_version = COALESCE(%s, hardware_version),
                location_label = COALESCE(%s, location_label),
                location_description = COALESCE(%s, location_description),
                plc_software_version = COALESCE(%s, plc_software_version),
                energy_meter_model = COALESCE(%s, energy_meter_model),
                deodor_model = COALESCE(%s, deodor_model),
                extractor_model = COALESCE(%s, extractor_model),
                has_stairs = COALESCE(%s, has_stairs),
                notes = COALESCE(%s, notes),
                connectivity_status = COALESCE(%s, connectivity_status),
                operational_status = COALESCE(%s, operational_status),
                is_active = COALESCE(%s, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (
            payload.serial_number.strip().upper() if payload.serial_number else None,
            model_name,
            capacity,
            payload.hardware_version,
            payload.location_label.strip() if payload.location_label else None,
            payload.location_description.strip() if payload.location_description else None,
            payload.plc_software_version.strip() if payload.plc_software_version else None,
            payload.energy_meter_model.strip() if payload.energy_meter_model else None,
            payload.deodor_model.strip() if payload.deodor_model else None,
            payload.extractor_model.strip() if payload.extractor_model else None,
            payload.has_stairs,
            payload.notes.strip() if payload.notes else None,
            payload.connectivity_status,
            payload.operational_status,
            payload.is_active,
            machine_id
        ))

        cur.execute(f"{SQL_SELECT_MACHINE_JOINED} WHERE m.id = %s;", (machine_id,))
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        return MachineResponse(**row_to_machine_dict(cols, row))

@router.delete("/{machine_id}")
def delete_machine(machine_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can delete machines."
        )
    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT machine_code, organization_id FROM machines WHERE id = %s AND (is_deleted IS NOT TRUE);", (machine_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Machine with ID '{machine_id}' not found."
            )
        code, org_id = row
        # Ensure only available machines can be deleted
        if org_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Machine '{code}' is currently assigned to a client. Only unassigned available machines can be deleted."
            )
        cur.execute("""
            UPDATE machines 
            SET is_deleted = TRUE, 
                deleted_at = CURRENT_TIMESTAMP, 
                deleted_by = %s,
                is_active = FALSE
            WHERE id = %s;
        """, (current_user.get("id"), machine_id))
        return {"success": True, "message": f"Machine '{code}' successfully removed from fleet inventory."}

@router.post("/{machine_id}/unassign")
def unassign_machine(machine_id: str, current_user: dict = Depends(get_current_user)):
    """Unassign a machine from its client organization and return it to available fleet."""
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can unassign machines."
        )
    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, serial_number, organization_id FROM machines WHERE id = %s AND (is_deleted IS NOT TRUE);", (machine_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

        # Clear organization mapping from machine
        cur.execute("UPDATE machines SET organization_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING serial_number;", (machine_id,))
        serial = cur.fetchone()[0]

        # Terminate active lease record in machine_leases
        cur.execute("UPDATE machine_leases SET lease_status = 'Terminated' WHERE machine_id = %s AND lease_status = 'Active';", (machine_id,))

        return {"success": True, "message": f"Machine '{serial}' unassigned successfully and returned to available fleet.", "id": machine_id}

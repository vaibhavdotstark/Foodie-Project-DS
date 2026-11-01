from typing import Optional, List
from datetime import datetime
import re
from pydantic import BaseModel, Field, field_validator

EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
SITE_CODE_REGEX = r'^[A-Za-z0-9-_]{2,20}$'
PHONE_REGEX = r'^\+?[0-9\s-]{8,16}$'
VALID_ROLES = ['OEM_MANAGER', 'SITE_ADMIN', 'OPERATOR']

# --------------------------------------------------------------------------
# Authentication Schemas
# --------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip()
        if not re.match(EMAIL_REGEX, clean):
            raise ValueError('Please enter a valid email address.')
        return clean.lower()

class UserResponse(BaseModel):
    id: str
    organization_id: Optional[str] = None
    assigned_site_id: Optional[str] = None
    email: str
    first_name: str
    last_name: str
    role: str
    phone_number: Optional[str] = None
    is_active: bool
    company_name: Optional[str] = None
    client_code: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(EMAIL_REGEX, clean):
            raise ValueError('Please enter a valid email address.')
        return clean

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 12:
            raise ValueError('Password must be at least 12 characters.')
        if not re.search(r'\d', v):
            raise ValueError('Password must include at least one number.')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must include at least one symbol.')
        return v


# --------------------------------------------------------------------------
# User Management Schemas
# --------------------------------------------------------------------------
class UserCreate(BaseModel):
    organization_id: Optional[str] = None
    assigned_site_id: Optional[str] = None
    email: str
    password: Optional[str] = 'password123'
    first_name: str
    last_name: str
    role: str
    phone_number: Optional[str] = None

    @field_validator('email')
    @classmethod
    def check_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(EMAIL_REGEX, clean):
            raise ValueError('Please enter a valid business email address.')
        return clean

    @field_validator('role')
    @classmethod
    def check_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
        return v

    @field_validator('password')
    @classmethod
    def check_password(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) < 8:
            raise ValueError('Password must be at least 8 characters long.')
        if v and (not re.search(r'[A-Za-z]', v) or not re.search(r'[0-9]', v)):
            raise ValueError('Password must contain at least 1 letter and 1 number.')
        return v

    @field_validator('phone_number')
    @classmethod
    def check_phone(cls, v: Optional[str]) -> Optional[str]:
        if v and v.strip() and not re.match(PHONE_REGEX, v.strip()):
            raise ValueError('Enter a valid phone number (e.g. +61 411 222 333).')
        return v.strip() if v else None

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    phone_number: Optional[str] = None
    password: Optional[str] = None
    assigned_site_id: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('role')
    @classmethod
    def check_role(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
        return v

# --------------------------------------------------------------------------
# Site Management Schemas
# --------------------------------------------------------------------------
class SiteCreate(BaseModel):
    organization_id: str
    site_code: str
    site_name: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = 'Australia/Adelaide'
    is_active: Optional[bool] = True

    @field_validator('site_code')
    @classmethod
    def check_site_code(cls, v: str) -> str:
        clean = v.strip().upper()
        if not re.match(SITE_CODE_REGEX, clean):
            raise ValueError('Site code must be 2-20 alphanumeric characters (hyphens allowed).')
        return clean

    @field_validator('site_name')
    @classmethod
    def check_site_name(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 3:
            raise ValueError('Facility / Site name must be at least 3 characters.')
        return clean

    @field_validator('address')
    @classmethod
    def check_address(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 5:
            raise ValueError('Physical installation address is required (min 5 characters).')
        return clean

    @field_validator('latitude')
    @classmethod
    def check_lat(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < -90 or v > 90):
            raise ValueError('Latitude must be between -90 and 90.')
        return v

    @field_validator('longitude')
    @classmethod
    def check_lng(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < -180 or v > 180):
            raise ValueError('Longitude must be between -180 and 180.')
        return v

class SiteUpdate(BaseModel):
    site_name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None

class SiteResponse(BaseModel):
    id: str
    organization_id: str
    site_code: str
    site_name: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: str
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# --------------------------------------------------------------------------
# Organization & Global Search Schemas
# --------------------------------------------------------------------------
class MachineAssignmentItem(BaseModel):
    machine_id: str
    location: Optional[str] = None
    lease_start_date: Optional[str] = None
    lease_end_date: Optional[str] = None

class OrganizationCreate(BaseModel):
    client_code: str
    company_name: str
    onboarding_date: Optional[str] = None
    business_type: Optional[str] = 'Corporate'
    status: Optional[str] = 'Active'
    tax_id: Optional[str] = None
    contact_poc: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    website: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    payment_terms: Optional[str] = '30 days'
    preferred_currency: Optional[str] = 'AUD'
    comms_preference: Optional[str] = 'Email'
    assigned_machines: Optional[List[MachineAssignmentItem]] = None
    is_active: Optional[bool] = True

    @field_validator('onboarding_date')
    @classmethod
    def check_onboarding_date(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        return v.strip()

    @field_validator('payment_terms')
    @classmethod
    def check_payment_terms(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return '30 days'
        clean = v.strip()
        if clean not in VALID_PAYMENT_TERMS:
            return '30 days'
        return clean

    @field_validator('comms_preference')
    @classmethod
    def check_comms_pref(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return 'Email'
        clean = v.strip()
        if clean not in VALID_COMMS_PREFERENCES:
            return 'Email'
        return clean

class OrganizationUpdate(BaseModel):
    company_name: Optional[str] = None
    onboarding_date: Optional[str] = None
    business_type: Optional[str] = None
    status: Optional[str] = None
    tax_id: Optional[str] = None
    contact_poc: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    website: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    payment_terms: Optional[str] = None
    preferred_currency: Optional[str] = None
    comms_preference: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('onboarding_date')
    @classmethod
    def check_onboarding_date_update(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        return v.strip()

class OrganizationResponse(BaseModel):
    id: str
    client_code: str
    company_name: str
    onboarding_date: Optional[str] = None
    business_type: Optional[str] = 'Corporate'
    status: Optional[str] = 'Active'
    tax_id: Optional[str] = None
    contact_poc: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    website: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    payment_terms: Optional[str] = None
    preferred_currency: Optional[str] = None
    comms_preference: Optional[str] = 'Email'
    is_active: bool
    is_deleted: Optional[bool] = False
    deleted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    deleted_by: Optional[str] = None

class BulkDeleteRequest(BaseModel):
    ids: List[str]

class SearchResultItemSite(BaseModel):
    id: str
    site_code: str
    site_name: str
    address: str
    timezone: str
    is_active: bool

class SearchResultItemUser(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    role: str
    phone_number: Optional[str] = None

class SearchResultItemMachine(BaseModel):
    id: str
    model: str
    location: str
    status: str
    temp: str

class SearchResponse(BaseModel):
    sites: List[SearchResultItemSite]
    users: List[SearchResultItemUser]
    machines: List[SearchResultItemMachine]

# --------------------------------------------------------------------------
# Machine Management & Commissioning Schemas
# --------------------------------------------------------------------------
MACHINE_CODE_REGEX = r'^[A-Za-z0-9-_]{2,20}$'
IP_ADDRESS_REGEX = r'^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
VALID_MACHINE_MODELS = {
    'Foodie F25': '25 kg/day',
    'Foodie F100': '100 kg/day',
    'Foodie F500': '500 kg/day',
    'Foodie F1000': '1000 kg/day',
    'F25': '25 kg/day',
    'F100': '100 kg/day',
    'F500': '500 kg/day',
    'F1000': '1000 kg/day',
}
VALID_LEASE_STATUSES = ['Active', 'Pending', 'Expired', 'Terminated']
VALID_CONNECTIVITY = ['Online', 'Offline']
VALID_PAYMENT_TERMS = ['15 days', '30 days', '60 days']
VALID_COMMS_PREFERENCES = ['Email', 'Phone']

class MachineModelResponse(BaseModel):
    id: str
    model_code: str
    display_name: str
    capacity: str
    is_active: bool

class MachineLeaseCreate(BaseModel):
    machine_id: str
    organization_id: str
    location_label: Optional[str] = None
    lease_reference: Optional[str] = None
    lease_start_date: str
    lease_end_date: str
    lease_status: Optional[str] = 'Active'

class MachineLeaseResponse(BaseModel):
    id: str
    lease_reference: Optional[str] = None
    machine_id: str
    organization_id: str
    location_label: Optional[str] = None
    lease_start_date: Optional[str] = None
    lease_end_date: Optional[str] = None
    lease_status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class MachineCreate(BaseModel):
    serial_number: str
    machine_code: Optional[str] = None
    model: str
    model_id: Optional[str] = None
    capacity: Optional[str] = None
    hardware_version: Optional[str] = None
    organization_id: Optional[str] = None
    location_label: Optional[str] = None
    location_description: Optional[str] = None
    plc_software_version: Optional[str] = None
    energy_meter_model: Optional[str] = None
    deodor_model: Optional[str] = None
    extractor_model: Optional[str] = None
    has_stairs: Optional[bool] = False
    notes: Optional[str] = None
    connectivity_status: Optional[str] = 'Offline'
    operational_status: Optional[str] = 'Idle'

    @field_validator('machine_code')
    @classmethod
    def check_machine_code(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        clean = v.strip().upper()
        if not re.match(MACHINE_CODE_REGEX, clean):
            raise ValueError('Machine Code must be 2-20 alphanumeric characters (e.g. C001, C137).')
        return clean

    @field_validator('serial_number')
    @classmethod
    def check_serial(cls, v: str) -> str:
        clean = v.strip().upper()
        if len(clean) < 2:
            raise ValueError('Serial number is required.')
        return clean

    @field_validator('model')
    @classmethod
    def check_model(cls, v: str) -> str:
        clean = v.strip()
        if clean not in VALID_MACHINE_MODELS:
            raise ValueError(f"Model must be one of: {', '.join(VALID_MACHINE_MODELS.keys())}")
        return clean

    @field_validator('connectivity_status')
    @classmethod
    def check_connectivity(cls, v: Optional[str]) -> str:
        if v and v not in VALID_CONNECTIVITY:
            raise ValueError(f"Connectivity status must be one of: {', '.join(VALID_CONNECTIVITY)}")
        return v or 'Offline'

class MachineUpdate(BaseModel):
    serial_number: Optional[str] = None
    model: Optional[str] = None
    model_id: Optional[str] = None
    capacity: Optional[str] = None
    hardware_version: Optional[str] = None
    organization_id: Optional[str] = None
    location_label: Optional[str] = None
    location_description: Optional[str] = None
    plc_software_version: Optional[str] = None
    energy_meter_model: Optional[str] = None
    deodor_model: Optional[str] = None
    extractor_model: Optional[str] = None
    has_stairs: Optional[bool] = None
    notes: Optional[str] = None
    connectivity_status: Optional[str] = None
    operational_status: Optional[str] = None
    is_active: Optional[bool] = None
    lease_start_date: Optional[str] = None
    lease_end_date: Optional[str] = None
    lease_status: Optional[str] = None

    @field_validator('connectivity_status')
    @classmethod
    def check_connectivity(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in VALID_CONNECTIVITY:
            raise ValueError(f"Connectivity status must be one of: {', '.join(VALID_CONNECTIVITY)}")
        return v

class MachineResponse(BaseModel):
    id: str
    machine_code: str
    serial_number: str
    model: str
    model_id: Optional[str] = None
    capacity: Optional[str] = None
    hardware_version: Optional[str] = None
    organization_id: Optional[str] = None
    client_code: Optional[str] = None
    company_name: Optional[str] = None
    location_label: Optional[str] = None
    location_description: Optional[str] = None
    plc_software_version: Optional[str] = None
    energy_meter_model: Optional[str] = None
    deodor_model: Optional[str] = None
    extractor_model: Optional[str] = None
    has_stairs: Optional[bool] = False
    notes: Optional[str] = None
    lease_start_date: Optional[str] = None
    lease_end_date: Optional[str] = None
    lease_status: Optional[str] = 'Active'
    lease_reference: Optional[str] = None
    connectivity_status: Optional[str] = 'Offline'
    operational_status: Optional[str] = 'Idle'
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    deleted_by: Optional[str] = None


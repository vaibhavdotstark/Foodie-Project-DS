export type UserRole = 'OEM_MANAGER' | 'SITE_ADMIN' | 'OPERATOR';

export type MachineStatus = 'RUNNING' | 'IDLE' | 'HALTED' | 'MAINTENANCE' | 'UNKNOWN';

export type ConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export type LeaseStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

export type ReturnCondition = 'EXCELLENT' | 'GOOD' | 'DAMAGED' | 'NEEDS_REPAIR';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface MachineModel {
  id: string;
  model_code: string;
  display_name: string;
  capacity: string;
  is_active: boolean;
}

export interface Organization {
  id: string;
  client_code: string;
  company_name: string;
  onboarding_date?: string;
  business_type?: 'Corporate' | 'Individual';
  status?: 'Active' | 'Pending' | 'Inactive';
  tax_id?: string;
  contact_poc: string;
  email: string;
  phone_number?: string;
  website?: string;
  billing_address?: string;
  shipping_address?: string;
  payment_terms?: string;
  preferred_currency?: string;
  comms_preference?: string;
  is_active: boolean;
  is_deleted?: boolean;
  deleted_at?: string;
  created_by?: string;
  deleted_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MachineAssignmentItem {
  machine_id: string;
  location?: string;
  lease_start_date?: string;
  lease_end_date?: string;
}

export interface OrganizationCreateData {
  client_code: string;
  company_name: string;
  onboarding_date?: string;
  business_type?: 'Corporate' | 'Individual';
  tax_id?: string;
  contact_poc?: string;
  phone_number?: string;
  email?: string;
  website?: string;
  billing_address?: string;
  shipping_address?: string;
  payment_terms?: string;
  comms_preference?: string;
  assigned_machines?: MachineAssignmentItem[];
  is_active?: boolean;
}

export interface Site {
  id: string;
  organization_id: string;
  site_code: string;
  site_name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  organization_id: string | null;
  assigned_site_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone_number?: string;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteFormData {
  organization_id: string;
  site_code: string;
  site_name: string;
  address: string;
  latitude?: string;
  longitude?: string;
  timezone: string;
  is_active: boolean;
}

export interface UserFormData {
  organization_id: string;
  assigned_site_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone_number: string;
  password: string;
  confirm_password: string;
}

export interface Machine {
  id: string;
  machine_code: string;
  serial_number: string;
  model: string;
  capacity?: string | null;
  hardware_version?: string | null;
  plc_ip?: string | null;
  organization_id: string | null;
  client_code?: string | null;
  company_name?: string | null;
  site_id?: string | null;
  site_code?: string | null;
  site_name?: string | null;
  location_label?: string | null;
  location_description?: string | null;
  plc_software_version?: string | null;
  energy_meter_model?: string | null;
  deodor_model?: string | null;
  extractor_model?: string | null;
  has_stairs?: boolean | null;
  notes?: string | null;
  lease_start_date?: string | null;
  lease_end_date?: string | null;
  lease_status: string;
  lease_reference?: string | null;
  manufacture_date?: string | null;
  warranty_expiry_date?: string | null;
  connectivity_status: string;
  operational_status?: string;
  is_active: boolean;
  is_deleted?: boolean;
  deleted_at?: string;
  created_by?: string;
  deleted_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MachineFormData {
  machine_code: string;
  serial_number: string;
  model: string;
  capacity?: string;
  hardware_version: string;
  plc_ip: string;
  organization_id: string;
  site_id: string;
  location_label: string;
  location_description?: string;
  plc_software_version?: string;
  energy_meter_model?: string;
  deodor_model?: string;
  extractor_model?: string;
  has_stairs?: boolean;
  notes?: string;
  lease_start_date: string;
  lease_end_date: string;
  lease_status: string;
  lease_reference: string;
  manufacture_date: string;
  warranty_expiry_date: string;
  connectivity_status: string;
  operational_status?: string;
}

export interface EnergyHistoryPoint {
  date: string;
  displayDate: string;
  fullDate: string;
  kwh: number;
}

export interface AttentionMachine {
  id: string;
  machine_code: string;
  client: string;
  issue: string;
  status: string;
  variant: string;
}

export interface UpcomingMaintenanceItem {
  id: string;
  machine_code: string;
  client: string;
  task: string;
  date: string;
}

export interface RecentClientItem {
  id: string;
  client_code: string;
  company_name: string;
  onboard_date: string;
  machines_count: number;
  status: string;
}

export interface DashboardStats {
  total_clients: number;
  clients_onboarded_this_month: number;
  total_machines: number;
  online_machines: number;
  offline_machines: number;
  energy_consumed_today_kwh: number;
  waste_intake_today_kg: number;
  compost_produced_today_kg: number;
  open_alerts_count: number;
  alert_clients_count: number;
  energy_history_14d: EnergyHistoryPoint[];
  attention_machines: AttentionMachine[];
  upcoming_maintenance: UpcomingMaintenanceItem[];
  recent_clients: RecentClientItem[];
}

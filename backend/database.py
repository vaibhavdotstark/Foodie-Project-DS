import os
from contextlib import contextmanager
from dotenv import load_dotenv
import psycopg2
from psycopg2.pool import SimpleConnectionPool
import bcrypt

load_dotenv()
if not os.getenv("DB_PASSWORD"):
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "foodie_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

pool = SimpleConnectionPool(
    minconn=1,
    maxconn=20,
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD
)

@contextmanager
def get_db_cursor(commit=False):
    """Context manager for acquiring a database connection and cursor from the pool."""
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            yield cur
            if commit:
                conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)

def init_db():
    """Verify database connection and initialize local development tables safely."""
    current_db = (os.getenv("DB_NAME") or DB_NAME or "").lower()
    current_env = os.getenv("ENVIRONMENT", "").lower()

    if current_db in ("foodie_prod", "prod", "production") or current_env in ("prod", "production"):
        print(f"Connected to production database '{DB_NAME}'. Demo seed data insertion is completely disabled.")
        return

    try:
        enum_conn = pool.getconn()
        enum_conn.set_isolation_level(0)
        with enum_conn.cursor() as cur:
            cur.execute("SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role_enum'::regtype;")
            existing_roles = {r[0] for r in cur.fetchall()}
            for r in ('ORGANISATION_OWNER', 'SITE_MANAGER'):
                if r not in existing_roles:
                    cur.execute(f"ALTER TYPE user_role_enum ADD VALUE '{r}';")
        pool.putconn(enum_conn)
    except Exception:
        pass

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS machine_models (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                model_code VARCHAR(50) UNIQUE NOT NULL,
                display_name VARCHAR(100) NOT NULL,
                capacity VARCHAR(50) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        models = [
            ('F25', 'Foodie F25', '25 kg/day'),
            ('F100', 'Foodie F100', '100 kg/day'),
            ('F500', 'Foodie F500', '500 kg/day'),
            ('F1000', 'Foodie F1000', '1000 kg/day'),
        ]
        for code, name, cap in models:
            cur.execute("""
                INSERT INTO machine_models (model_code, display_name, capacity)
                VALUES (%s, %s, %s)
                ON CONFLICT (model_code) DO NOTHING;
            """, (code, name, cap))

        cur.execute("SELECT id FROM organizations WHERE client_code = 'CL-0001';")
        org = cur.fetchone()
        if not org:
            cur.execute("""
                INSERT INTO organizations (
                    client_code, company_name, tax_id, contact_poc, email, phone_number,
                    website, billing_address, shipping_address, payment_terms, preferred_currency, is_active
                ) VALUES (
                    'CL-0001', 'Green Valley Foods Pty Ltd', 'ABN 12 345 678 901', 'Jordan Smith',
                    'jordan@greenvalley.example', '+61 8 8200 1100', 'https://greenvalley.example',
                    'Railway Ave, Mount Isa QLD 4825', 'Railway Ave, Mount Isa QLD 4825', '30 days', 'AUD', true
                ) RETURNING id;
            """)
            org_id = cur.fetchone()[0]
        else:
            org_id = org[0]

        pw_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt(10)).decode('utf-8')

        cur.execute("DELETE FROM users WHERE email IN ('admin@powertech.example', 'sam.taylor@greenvalley.example', 'priya.shah@greenvalley.example');")

        cur.execute("SELECT id FROM users WHERE LOWER(email) = 'oem@gmail.com';")
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, phone_number, is_active)
                VALUES (NULL, 'oem@gmail.com', %s, 'OEM', 'Manager', 'OEM_MANAGER', '+61 8 8000 0001', true);
            """, (pw_hash,))

        cur.execute("SELECT id FROM users WHERE LOWER(email) = 'siteadmin@gmail.com';")
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, phone_number, is_active)
                VALUES (%s, 'siteadmin@gmail.com', %s, 'Site', 'Admin', 'SITE_ADMIN', '+61 422 111 222', true);
            """, (org_id, pw_hash))

        cur.execute("SELECT id FROM users WHERE LOWER(email) = 'operator@gmail.com';")
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, phone_number, is_active)
                VALUES (%s, 'operator@gmail.com', %s, 'Composter', 'Operator', 'OPERATOR', '+61 433 222 333', true);
            """, (org_id, pw_hash))

        cur.execute("""
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
            ALTER TABLE users DROP COLUMN IF EXISTS assigned_site_id;
            ALTER TABLE organizations ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) DEFAULT 'Corporate';
            ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
            ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_date DATE DEFAULT CURRENT_DATE;
            ALTER TABLE organizations ADD COLUMN IF NOT EXISTS comms_preference VARCHAR(50) DEFAULT 'Email';
            ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
            ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
            ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
            ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
            ALTER TABLE organizations ALTER COLUMN contact_poc DROP NOT NULL;
            ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_client_code_key;
            CREATE UNIQUE INDEX IF NOT EXISTS organizations_client_code_active_unique ON organizations (UPPER(client_code)) WHERE (is_deleted IS NOT TRUE);
            ALTER TABLE machines ALTER COLUMN capacity DROP NOT NULL;
            ALTER TABLE machines ALTER COLUMN hardware_version DROP DEFAULT;
            ALTER TABLE machines ALTER COLUMN operational_status SET DEFAULT 'Idle';
            ALTER TABLE machines ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
            ALTER TABLE machines ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
            ALTER TABLE machines DROP COLUMN IF EXISTS plc_ip;
        """)

        # Physical sites table and tenant hierarchy relationships
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sites (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                site_code VARCHAR(50) NOT NULL,
                site_name VARCHAR(100) NOT NULL,
                address TEXT,
                timezone VARCHAR(50) DEFAULT 'Australia/Adelaide',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_org_site_code UNIQUE (organization_id, site_code)
            );
            ALTER TABLE sites DROP COLUMN IF EXISTS latitude;
            ALTER TABLE sites DROP COLUMN IF EXISTS longitude;
            CREATE INDEX IF NOT EXISTS idx_sites_organization_id ON sites(organization_id);

            ALTER TABLE machines ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE SET NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE SET NULL;
            ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_machines_site_id ON machines(site_id);
            CREATE INDEX IF NOT EXISTS idx_users_site_id ON users(site_id);
            CREATE INDEX IF NOT EXISTS idx_user_invitations_site_id ON user_invitations(site_id);
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS machines (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                machine_code VARCHAR(50) UNIQUE NOT NULL,
                serial_number VARCHAR(100) NOT NULL,
                model_id UUID REFERENCES machine_models(id) ON DELETE SET NULL,
                model VARCHAR(50) NOT NULL,
                capacity VARCHAR(50),
                hardware_version VARCHAR(20),
                organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
                location_label VARCHAR(100),
                location_description TEXT,
                plc_software_version VARCHAR(100),
                energy_meter_model VARCHAR(100),
                deodor_model VARCHAR(100),
                extractor_model VARCHAR(100),
                has_stairs BOOLEAN DEFAULT FALSE,
                notes TEXT,
                connectivity_status VARCHAR(50) DEFAULT 'Offline',
                operational_status VARCHAR(50) DEFAULT 'Idle',
                is_deleted BOOLEAN DEFAULT FALSE,
                deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS machine_leases (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                lease_reference VARCHAR(100) UNIQUE,
                machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
                organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
                location_label VARCHAR(100),
                lease_start_date DATE NOT NULL,
                lease_end_date DATE NOT NULL,
                lease_status VARCHAR(50) DEFAULT 'Active',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_invitations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                email VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                token VARCHAR(255) UNIQUE NOT NULL,
                status VARCHAR(50) DEFAULT 'PENDING',
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
            CREATE INDEX IF NOT EXISTS idx_user_invitations_org_email ON user_invitations(organization_id, email);
        """)

        cur.execute("SELECT COUNT(*) FROM machines;")
        if cur.fetchone()[0] == 0:
            cur.execute("SELECT id FROM machine_models WHERE model_code = 'F25';")
            f25_id = cur.fetchone()[0]
            cur.execute("SELECT id FROM machine_models WHERE model_code = 'F100';")
            f100_id = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO machines (
                    machine_code, serial_number, model_id, model, capacity, hardware_version,
                    organization_id, location_label, connectivity_status, is_active
                ) VALUES 
                ('C001', 'C001', %s, 'Foodie F100', '100 kg/day', 'v2.1', %s, 'Kitchen Loading Bay', 'Offline', true),
                ('C002', 'C002', %s, 'Foodie F25', '25 kg/day', 'v2.1', %s, 'Carpark Bay 2', 'Offline', true),
                ('C003', 'C003', %s, 'Foodie F25', '25 kg/day', 'v1.0', %s, 'Mawson Processing Hub', 'Offline', true);
            """, (f100_id, org_id, f25_id, org_id, f25_id, org_id))

        # Default sites for initial demonstration client
        if org_id:
            cur.execute("SELECT COUNT(*) FROM sites WHERE organization_id = %s;", (org_id,))
            if cur.fetchone()[0] == 0:
                cur.execute("""
                    INSERT INTO sites (organization_id, site_code, site_name, address)
                    VALUES 
                    (%s, 'SITE-01', 'Kitchen Loading Bay', 'Railway Ave, Mount Isa QLD 4825'),
                    (%s, 'SITE-02', 'Mawson Processing Hub', '14 Industrial Circuit, Mount Isa QLD 4825')
                    ON CONFLICT (organization_id, site_code) DO NOTHING;
                """, (org_id, org_id))
            cur.execute("""
                UPDATE machines m
                SET site_id = s.id
                FROM sites s
                WHERE m.organization_id = s.organization_id
                  AND m.location_label = s.site_name
                  AND m.site_id IS NULL;
            """)

    print("Database connection initialized and verified successfully.")

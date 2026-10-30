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

# Initialize PostgreSQL Connection Pool
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

    # Safety Guard: If connected to the AWS production database (foodie_prod), never insert demo or seed data
    if current_db in ("foodie_prod", "prod", "production") or current_env in ("prod", "production"):
        print(f"Connected to production database '{DB_NAME}'. Demo seed data insertion is completely disabled.")
        return

    with get_db_cursor(commit=True) as cur:
        # 1. Machine Models Table (Dynamic, not hardcoded)
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

        # Seed standard Foodie composter models if not present
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

        # 2. Organization setup for local development
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

        # 3. Default accounts for local development
        pw_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt(10)).decode('utf-8')

        cur.execute("DELETE FROM users WHERE email IN ('admin@powertech.example', 'sam.taylor@greenvalley.example', 'priya.shah@greenvalley.example');")

        # OEM Manager
        cur.execute("SELECT id FROM users WHERE LOWER(email) = 'oem@gmail.com';")
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, phone_number, is_active)
                VALUES (NULL, 'oem@gmail.com', %s, 'OEM', 'Manager', 'OEM_MANAGER', '+61 8 8000 0001', true);
            """, (pw_hash,))

        # Site Admin
        cur.execute("SELECT id FROM users WHERE LOWER(email) = 'siteadmin@gmail.com';")
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, phone_number, is_active)
                VALUES (%s, 'siteadmin@gmail.com', %s, 'Site', 'Admin', 'SITE_ADMIN', '+61 422 111 222', true);
            """, (org_id, pw_hash))

        # Operator
        cur.execute("SELECT id FROM users WHERE LOWER(email) = 'operator@gmail.com';")
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, phone_number, is_active)
                VALUES (%s, 'operator@gmail.com', %s, 'Composter', 'Operator', 'OPERATOR', '+61 433 222 333', true);
            """, (org_id, pw_hash))

        # Ensure schema columns and migrations exist
        cur.execute("""
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
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
            ALTER TABLE machines DROP COLUMN IF EXISTS site_id;
            ALTER TABLE machine_leases DROP COLUMN IF EXISTS site_id;
            DROP TABLE IF EXISTS sites CASCADE;
        """)

        # 4. Machines table setup for local development
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

        # 5. Machine Leases Table
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

        # Ensure seed machines exist if table is empty
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

    print("Database connection initialized and verified successfully.")

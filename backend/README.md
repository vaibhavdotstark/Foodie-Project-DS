# Foodie Composter Operations API — FastAPI (Python 3.11)

Production-grade REST API backend built with **FastAPI**, **Pydantic v2**, and **PostgreSQL (`foodie_db`)**.

---

## 1. Quick Start

### Option A: 1-Click Startup (Windows)
Double-click:
```
backend\run_fastapi.bat
```

### Option B: Command Line
```powershell
# From the project root:
py -3.11 -m uvicorn backend.main:app --host 0.0.0.0 --port 5000 --reload
```

- **API Base URL**: `http://localhost:5000`
- **Interactive Swagger Documentation**: `http://localhost:5000/docs`
- **Alternative ReDoc Documentation**: `http://localhost:5000/redoc`

---

## 2. Default Seeded Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **OEM Manager** | `oem@gmail.com` | `admin123` |
| **Site Admin** | `siteadmin@gmail.com` | `admin123` |
| **Operator** | `operator@gmail.com` | `admin123` |

---

## 3. Database Connection (`database.py`)
- **Database Engine**: PostgreSQL 16
- **Database Name**: `foodie_db`
- **Host**: `localhost:5432`
- **User**: `postgres`
- **Password**: `Rajasthan@2005`
- **Connection Pool**: `psycopg2.pool.SimpleConnectionPool`

---

## 4. API Endpoints

### Authentication (`routers/auth.py`)
- `POST /api/auth/login` — Authenticates user via bcrypt, returns 24h JWT token and user profile.
- `GET /api/auth/me` — Returns current logged-in user details verified from JWT header (`Authorization: Bearer <token>`).

### Sites & Facilities (`routers/sites.py`)
- `GET /api/sites` — Returns all registered installation facilities.
- `POST /api/sites` — Registers a new site (validates unique site code per organization, GPS coordinates, required address).
- `PUT /api/sites/{site_id}` — Updates facility name, physical address, GPS coordinates, timezone, or active status.
- `DELETE /api/sites/{site_id}` — Deletes site facility.

### Users & Access Control (`routers/users.py`)
- `GET /api/users` — Returns authorized accounts.
- `POST /api/users` — Creates user account (enforces unique email, bcrypt password hash, role scope).
- `PUT /api/users/{user_id}` — Updates name, phone, role, assigned site, active status.
- `DELETE /api/users/{user_id}` — Deactivates or removes user account.

### Organizations (`routers/organizations.py`)
- `GET /api/organizations` — Returns client organization details (`Green Valley Foods Pty Ltd`, `CL-0042`).

### Global Search (`routers/search.py`)
- `GET /api/search?q={query}` — Searches PostgreSQL `sites`, `users`, and live composter machines simultaneously.

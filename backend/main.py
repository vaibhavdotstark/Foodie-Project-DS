import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db
from .routers import auth, users, organizations, search, machines, dashboard

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

is_production = os.getenv("ENVIRONMENT", "").lower() in ("production", "prod") or os.getenv("DB_NAME", "").lower() in ("foodie_prod", "prod")

app = FastAPI(
    title="PowerTech Energy — Foodie Composter API",
    description="Operations REST API for Foodie Composter Telemetry Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    for origin in allowed_origins_env.split(","):
        cleaned = origin.strip()
        if cleaned and cleaned not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?" if not is_production else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(organizations.router)
app.include_router(search.router)
app.include_router(machines.router)
app.include_router(dashboard.router)

@app.get("/api/machine-models", tags=["Machines"])
def get_machine_models_alias():
    return machines.get_machine_models()

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "online"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=5000, reload=True)

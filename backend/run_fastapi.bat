@echo off
echo ===================================================
echo Starting Foodie FastAPI Backend on http://localhost:5000
echo Connected to PostgreSQL database: foodie_db
echo Swagger Documentation at: http://localhost:5000/docs
echo ===================================================
cd /d "%~dp0\.."

if exist ".venv\Scripts\python.exe" (
    echo Using virtual environment (.venv)...
    .venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 5000 --reload
) else (
    echo Virtual environment not found, using system Python...
    python -m uvicorn backend.main:app --host 0.0.0.0 --port 5000 --reload
)
pause

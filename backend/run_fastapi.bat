@echo off
echo ===================================================
echo Starting Foodie FastAPI Backend on http://localhost:5000
echo Connected to PostgreSQL database: foodie_db
echo Swagger Documentation at: http://localhost:5000/docs
echo ===================================================
cd /d "%~dp0\.."
py -3.11 -m uvicorn backend.main:app --host 0.0.0.0 --port 5000 --reload
pause

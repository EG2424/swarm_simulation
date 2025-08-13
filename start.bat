@echo off
echo Starting LLM Swarm Simulation...
echo.
echo Activating virtual environment...
call llmswarm-env\Scripts\activate.bat

echo.
echo Starting server on http://localhost:8000
echo Press Ctrl+C to stop
echo.

python main.py

pause
# How to Start and Stop the LLM Swarm Application

## Starting the Application

1. **Simple Start:**
   ```bash
   ./start.bat
   ```
   This will:
   - Activate the Python virtual environment
   - Start the FastAPI server on http://localhost:8000
   - Begin the simulation loop
   - Open the web interface

2. **Access the Application:**
   - Open browser to: http://localhost:8000
   - WebSocket connection establishes automatically

## Stopping the Application

**Method 1: Graceful Stop (Recommended)**
- Press `Ctrl+C` in the terminal where start.bat is running
- Wait for "Application shutdown complete" message

**Method 2: Kill Process (If Ctrl+C doesn't work)**
1. Find the process using port 8000:
   ```bash
   netstat -ano | findstr :8000
   ```
2. Kill the process (replace PID with actual process ID):
   ```bash
   tskill [PID]
   ```

## Restarting the Application

1. **Stop** the current instance using Method 1 or 2 above
2. **Wait** for port to be freed (no processes on port 8000)
3. **Start** again with `./start.bat`

## Troubleshooting

**Port Already in Use Error:**
- Another instance is running on port 8000
- Use Method 2 to kill the existing process
- Then restart with ./start.bat

**Server Won't Start:**
- Check if virtual environment exists in `llmswarm-env/`
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Check Python version compatibility

## Development Notes

- Server runs on http://0.0.0.0:8000 (accessible from other devices on network)
- WebSocket endpoint: ws://localhost:8000/ws
- Static files served from `/static` directory
- Scenarios loaded from `/scenarios` directory
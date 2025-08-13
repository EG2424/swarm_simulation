# Quick Setup Guide

## Virtual Environment Setup (Windows)

The virtual environment has been created and all dependencies installed. Here's how to use it:

### Option 1: Use the Start Script (Recommended)
```bash
# Double-click or run from command line:
start.bat
```
This will:
- Activate the virtual environment automatically
- Start the simulation server
- Open on http://localhost:8000

### Option 2: Manual Activation
```bash
# Activate the virtual environment
activate.bat

# Then run the simulation
python main.py
```

### Option 3: Command Line
```bash
# Activate virtual environment
llmswarm-env\Scripts\activate.bat

# Start simulation
python main.py
```

## Accessing the Simulation

Once the server starts, open your web browser and navigate to:
**http://localhost:8000**

## Virtual Environment Details

- **Environment name**: `llmswarm-env`
- **Python version**: Python 3.12
- **Installed packages**:
  - FastAPI (web framework)
  - Uvicorn (ASGI server)  
  - WebSockets (real-time communication)
  - Pydantic (data validation)
  - NumPy (numerical operations)
  - HTTPx (HTTP client for LLM integration)
  - And other dependencies...

## Usage

1. **Start Simulation**: Click the "Start" button
2. **Add Entities**: Use "+ Drone" and "+ Tank" buttons
3. **Control Entities**: Click to select, use WASD for manual control
4. **Load Scenarios**: Choose from dropdown in left sidebar
5. **Speed Control**: Use speed slider to adjust simulation speed
6. **Zoom & Scale**: Use sliders to adjust view and entity sizes

## Troubleshooting

- **Port 8000 in use**: Kill other processes using port 8000
- **WebSocket errors**: Check firewall settings
- **Performance issues**: Reduce entity count or increase scale

## Stopping the Simulation

Press `Ctrl+C` in the command window to stop the server.

Enjoy your 2D drone-tank simulation! 🚁🛡️
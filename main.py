#!/usr/bin/env python3
"""
LLM Swarm Simulation - Main FastAPI Application
2D Drone-Tank Simulation with WebSocket Communication
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Set
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from simulation.engine import SimulationEngine
from simulation.entities import Drone, Tank
from communication.message_router import MessageRouter
from communication.schemas import *
from llm.integration import LLMManager


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")


# Global instances
simulation_engine = SimulationEngine()
message_router = MessageRouter()
connection_manager = ConnectionManager()
llm_manager = LLMManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start simulation loop
    simulation_task = asyncio.create_task(simulation_loop())
    yield
    # Clean up
    simulation_task.cancel()
    try:
        await simulation_task
    except asyncio.CancelledError:
        pass
    
    # Close LLM manager
    await llm_manager.close()


app = FastAPI(
    title="LLM Swarm Simulation",
    description="2D Drone-Tank Simulation with WebSocket Communication",
    version="1.0.0",
    lifespan=lifespan
)

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def get_index():
    """Serve the main HTML interface"""
    try:
        with open("static/index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Frontend not found. Please ensure static/index.html exists.</h1>")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for real-time communication"""
    await connection_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Route message through message router
            response = await message_router.handle_message(message, simulation_engine)
            
            if response:
                # Check if this response should be broadcasted (e.g., reset command)
                if response.get("data", {}).get("should_broadcast") and response.get("data", {}).get("broadcast_state"):
                    await connection_manager.broadcast(json.dumps({
                        "type": "simulation_update", 
                        "data": response["data"]["broadcast_state"]
                    }))
                
                await connection_manager.send_personal_message(
                    json.dumps(response), websocket
                )
                
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        connection_manager.disconnect(websocket)


# REST API Endpoints
@app.get("/api/simulation/state")
async def get_simulation_state():
    """Get current simulation state"""
    return simulation_engine.get_state()


@app.post("/api/simulation/control")
async def control_simulation(command: SimulationControlRequest):
    """Control simulation (start/pause/reset/speed)"""
    result = simulation_engine.handle_control_command(command)
    
    # Broadcast state change to all connected clients
    await connection_manager.broadcast(json.dumps({
        "type": "simulation_state_changed",
        "data": simulation_engine.get_state()
    }))
    
    return result


@app.post("/api/entities/spawn")
async def spawn_entity(request: SpawnEntityRequest):
    """Spawn a new entity (drone or tank)"""
    entity = simulation_engine.spawn_entity(request)
    
    # Broadcast entity spawn to all clients
    await connection_manager.broadcast(json.dumps({
        "type": "entity_spawned",
        "data": entity.to_dict()
    }))
    
    return entity.to_dict()


@app.post("/api/entities/{entity_id}/command")
async def command_entity(entity_id: str, command: EntityCommandRequest):
    """Send command to specific entity"""
    result = simulation_engine.command_entity(entity_id, command)
    
    # Broadcast entity update to all clients
    await connection_manager.broadcast(json.dumps({
        "type": "entity_updated",
        "data": {"entity_id": entity_id, "command": command.dict()}
    }))
    
    return result


@app.delete("/api/entities/{entity_id}")
async def remove_entity(entity_id: str):
    """Remove entity from simulation"""
    result = simulation_engine.remove_entity(entity_id)
    
    # Broadcast entity removal to all clients
    await connection_manager.broadcast(json.dumps({
        "type": "entity_removed",
        "data": {"entity_id": entity_id}
    }))
    
    return result


@app.get("/api/scenarios")
async def list_scenarios():
    """List available scenarios"""
    return simulation_engine.list_scenarios()


@app.post("/api/scenarios/load")
async def load_scenario(request: LoadScenarioRequest):
    """Load a scenario"""
    result = simulation_engine.load_scenario(request)
    
    # Broadcast scenario loaded to all clients
    await connection_manager.broadcast(json.dumps({
        "type": "scenario_loaded",
        "data": simulation_engine.get_state()
    }))
    
    return result


# LLM Integration Endpoints
@app.post("/api/llm/chat")
async def llm_chat(request: LLMRequest):
    """Process LLM chat request for drone control"""
    try:
        response = await llm_manager.process_request(request, simulation_engine)
        
        # Execute any commands returned by LLM
        for command in response.commands:
            try:
                result = simulation_engine.command_entity(request.drone_id, command)
                logger.info(f"LLM commanded drone {request.drone_id}: {command.dict()}")
                
                # Broadcast command execution to clients
                await connection_manager.broadcast(json.dumps({
                    "type": "llm_command_executed",
                    "data": {
                        "drone_id": request.drone_id,
                        "command": command.dict(),
                        "result": result
                    }
                }))
                
            except Exception as e:
                logger.error(f"Failed to execute LLM command: {e}")
        
        # Broadcast LLM response to chat
        if response.response:
            await connection_manager.broadcast(json.dumps({
                "type": "chat_message_added",
                "data": {
                    "sender": f"Drone {request.drone_id[:8]}",
                    "content": response.response,
                    "timestamp": response.timestamp,
                    "message_type": "llm"
                }
            }))
        
        return response.dict()
        
    except Exception as e:
        logger.error(f"LLM chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/llm/configure")
async def configure_llm(config: dict):
    """Configure LLM settings"""
    try:
        llm_manager.configure(**config)
        return {"success": True, "message": "LLM configuration updated"}
    except Exception as e:
        logger.error(f"LLM configuration error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/llm/sessions")
async def get_llm_sessions():
    """Get active LLM sessions"""
    return {
        "active_sessions": llm_manager.get_active_sessions(),
        "session_count": len(llm_manager.get_active_sessions())
    }


@app.delete("/api/llm/sessions/{drone_id}")
async def clear_llm_session(drone_id: str):
    """Clear LLM session for specific drone"""
    llm_manager.clear_session(drone_id)
    return {"success": True, "message": f"Session cleared for drone {drone_id}"}


async def simulation_loop():
    """Main simulation loop running in background"""
    while True:
        try:
            # Update simulation
            delta_state = simulation_engine.update()
            
            # Broadcast updates if there are changes
            if delta_state and connection_manager.active_connections:
                await connection_manager.broadcast(json.dumps({
                    "type": "simulation_update",
                    "data": delta_state
                }))
                
            # Sleep for fixed timestep
            await asyncio.sleep(simulation_engine.dt)
            
        except Exception as e:
            logger.error(f"Simulation loop error: {e}")
            await asyncio.sleep(0.1)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
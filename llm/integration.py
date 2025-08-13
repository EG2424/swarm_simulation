"""
LLM Integration - OpenAI-compatible endpoints for drone control
"""

import json
import logging
import asyncio
from typing import Dict, List, Optional, Any, AsyncGenerator
from dataclasses import dataclass
from datetime import datetime

import httpx
from fastapi import HTTPException

from communication.schemas import *
from simulation.entities import Drone, Tank


logger = logging.getLogger(__name__)


@dataclass
class LLMConfig:
    """Configuration for LLM integration"""
    base_url: str = "https://api.openai.com/v1"
    api_key: Optional[str] = None
    model: str = "gpt-4"
    max_tokens: int = 500
    temperature: float = 0.7
    timeout: int = 30
    max_retries: int = 3


class LLMDroneController:
    """Controls drones using LLM-generated commands"""
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self.client = httpx.AsyncClient(timeout=config.timeout)
        self.conversation_history: Dict[str, List[Dict[str, str]]] = {}
        
    async def process_drone_request(self, request: LLMRequest, simulation_engine) -> LLMResponse:
        """Process LLM request for drone control"""
        try:
            # Get drone context
            drone_context = self._get_drone_context(request.drone_id, simulation_engine)
            if not drone_context:
                raise HTTPException(status_code=404, detail="Drone not found")
            
            # Prepare messages for LLM
            messages = self._prepare_messages(request, drone_context)
            
            # Call LLM API
            if request.stream:
                response = await self._stream_llm_response(messages)
            else:
                response = await self._call_llm_api(messages)
            
            # Parse response and extract commands
            parsed_response = self._parse_llm_response(response, request.drone_id)
            
            # Store in conversation history
            self._update_conversation_history(request.drone_id, request.prompt, parsed_response.response)
            
            return parsed_response
            
        except Exception as e:
            logger.error(f"LLM request error: {e}")
            return LLMResponse(
                drone_id=request.drone_id,
                response=f"Error processing request: {str(e)}",
                commands=[],
                timestamp=datetime.now().timestamp()
            )
    
    def _get_drone_context(self, drone_id: str, simulation_engine) -> Optional[Dict[str, Any]]:
        """Get comprehensive context about the drone and simulation state"""
        if drone_id not in simulation_engine.entities:
            return None
            
        drone = simulation_engine.entities[drone_id]
        if not isinstance(drone, Drone):
            return None
        
        # Get nearby entities
        nearby_entities = []
        for entity in simulation_engine.entities.values():
            if entity.id != drone_id:
                distance = drone.distance_to(entity)
                if distance <= 100:  # Within 100 units
                    nearby_entities.append({
                        "id": entity.id,
                        "type": entity.type.value,
                        "distance": round(distance, 2),
                        "position": {"x": entity.position.x, "y": entity.position.y},
                        "status": getattr(entity, 'status', 'unknown'),
                        "destroyed": entity.destroyed
                    })
        
        # Get simulation state
        sim_state = simulation_engine.get_state()
        
        context = {
            "drone": {
                "id": drone.id,
                "position": {"x": drone.position.x, "y": drone.position.y},
                "heading": drone.heading,
                "mode": drone.mode.value,
                "status": drone.status,
                "health": drone.health,
                "target_position": {
                    "x": drone.target_position.x, "y": drone.target_position.y
                } if drone.target_position else None,
                "target_entity_id": drone.target_entity_id,
                "patrol_route": [
                    {"x": p.x, "y": p.y} for p in drone.patrol_route
                ] if drone.patrol_route else []
            },
            "simulation": {
                "time": sim_state["simulation"]["time"],
                "arena_bounds": sim_state["simulation"]["arena_bounds"],
                "total_entities": sim_state["metrics"]["total_entities"],
                "drones": sim_state["metrics"]["drones"],
                "tanks": sim_state["metrics"]["tanks"]
            },
            "nearby_entities": nearby_entities,
            "available_modes": [
                "go_to", "follow_tank", "follow_teammate", 
                "random_search", "patrol_route", "hold_position"
            ]
        }
        
        return context
    
    def _prepare_messages(self, request: LLMRequest, context: Dict[str, Any]) -> List[Dict[str, str]]:
        """Prepare messages for LLM API call"""
        system_prompt = self._get_system_prompt()
        
        # Get conversation history
        history = self.conversation_history.get(request.drone_id, [])
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history (last 10 messages)
        messages.extend(history[-10:])
        
        # Add current context and request
        context_str = f"Current context:\n```json\n{json.dumps(context, indent=2)}\n```"
        user_message = f"{context_str}\n\nUser request: {request.prompt}"
        
        messages.append({"role": "user", "content": user_message})
        
        return messages
    
    def _get_system_prompt(self) -> str:
        """Get system prompt for drone control"""
        return """You are an AI controlling a drone in a 2D tactical simulation. Your goal is to help the user control the drone effectively.

AVAILABLE COMMANDS:
- go_to: Move to specific coordinates {"mode": "go_to", "target_position": {"x": X, "y": Y}}
- follow_tank: Follow a specific tank {"mode": "follow_tank", "target_entity_id": "tank_id"}
- follow_teammate: Follow another drone {"mode": "follow_teammate", "target_entity_id": "drone_id"}
- random_search: Search randomly for targets {"mode": "random_search"}
- patrol_route: Patrol specific waypoints {"mode": "patrol_route", "patrol_route": [{"x": X1, "y": Y1}, {"x": X2, "y": Y2}]}
- hold_position: Stay at current location {"mode": "hold_position"}

BEHAVIOR RULES:
1. Red tanks are undiscovered, blue tanks are discovered, grey entities are destroyed
2. Drones can engage tanks by getting very close (kamikaze attack)
3. Arena bounds are typically 800x600 pixels
4. Consider tactical positioning and coordination with other drones
5. Respond with both natural language explanation AND JSON command structure

RESPONSE FORMAT:
Always respond with:
1. A brief explanation of your decision
2. If commanding the drone, include a JSON command block like:
```json
{"mode": "go_to", "target_position": {"x": 400, "y": 300}}
```

Be tactical, efficient, and helpful. Coordinate with other entities when possible."""
    
    async def _call_llm_api(self, messages: List[Dict[str, str]]) -> str:
        """Call LLM API synchronously"""
        if not self.config.api_key:
            return "LLM integration not configured - no API key provided"
        
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.config.model,
            "messages": messages,
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "stream": False
        }
        
        try:
            response = await self.client.post(
                f"{self.config.base_url}/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            
            data = response.json()
            return data["choices"][0]["message"]["content"]
            
        except httpx.HTTPStatusError as e:
            logger.error(f"LLM API HTTP error: {e.response.status_code} {e.response.text}")
            return f"LLM API error: {e.response.status_code}"
        except Exception as e:
            logger.error(f"LLM API error: {e}")
            return f"LLM API error: {str(e)}"
    
    async def _stream_llm_response(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        """Stream LLM response (placeholder for future implementation)"""
        # TODO: Implement streaming response
        response = await self._call_llm_api(messages)
        yield response
    
    def _parse_llm_response(self, response: str, drone_id: str) -> LLMResponse:
        """Parse LLM response and extract commands"""
        commands = []
        
        # Look for JSON command blocks in the response
        import re
        json_pattern = r'```json\s*({.*?})\s*```'
        matches = re.findall(json_pattern, response, re.DOTALL)
        
        for match in matches:
            try:
                command_data = json.loads(match)
                
                # Validate command structure
                if "mode" in command_data:
                    command = EntityCommandRequest(
                        mode=command_data["mode"],
                        target_position=Vector2D(**command_data["target_position"]) 
                            if "target_position" in command_data else None,
                        target_entity_id=command_data.get("target_entity_id"),
                        patrol_route=[Vector2D(**pos) for pos in command_data["patrol_route"]] 
                            if "patrol_route" in command_data else None
                    )
                    commands.append(command)
                    
            except Exception as e:
                logger.warning(f"Failed to parse command: {match} - {e}")
        
        return LLMResponse(
            drone_id=drone_id,
            response=response,
            commands=commands,
            timestamp=datetime.now().timestamp()
        )
    
    def _update_conversation_history(self, drone_id: str, user_message: str, assistant_response: str):
        """Update conversation history for context"""
        if drone_id not in self.conversation_history:
            self.conversation_history[drone_id] = []
        
        history = self.conversation_history[drone_id]
        history.append({"role": "user", "content": user_message})
        history.append({"role": "assistant", "content": assistant_response})
        
        # Keep only last 20 messages per drone
        if len(history) > 20:
            self.conversation_history[drone_id] = history[-20:]
    
    def clear_conversation_history(self, drone_id: Optional[str] = None):
        """Clear conversation history for specific drone or all drones"""
        if drone_id:
            self.conversation_history.pop(drone_id, None)
        else:
            self.conversation_history.clear()
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


class LLMManager:
    """Manages multiple LLM controllers and handles requests"""
    
    def __init__(self):
        self.config = LLMConfig()
        self.controller = LLMDroneController(self.config)
        self.active_sessions: Dict[str, datetime] = {}
    
    def configure(self, **kwargs):
        """Configure LLM settings"""
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
        
        # Recreate controller with new config
        self.controller = LLMDroneController(self.config)
    
    async def process_request(self, request: LLMRequest, simulation_engine) -> LLMResponse:
        """Process LLM request"""
        # Track active session
        self.active_sessions[request.drone_id] = datetime.now()
        
        try:
            return await self.controller.process_drone_request(request, simulation_engine)
        finally:
            # Clean up old sessions
            self._cleanup_old_sessions()
    
    def _cleanup_old_sessions(self):
        """Clean up sessions older than 1 hour"""
        cutoff = datetime.now().timestamp() - 3600  # 1 hour
        old_sessions = [
            drone_id for drone_id, timestamp in self.active_sessions.items()
            if timestamp.timestamp() < cutoff
        ]
        
        for drone_id in old_sessions:
            self.active_sessions.pop(drone_id, None)
            self.controller.conversation_history.pop(drone_id, None)
    
    def get_active_sessions(self) -> List[str]:
        """Get list of active LLM sessions"""
        return list(self.active_sessions.keys())
    
    def clear_session(self, drone_id: str):
        """Clear specific LLM session"""
        self.active_sessions.pop(drone_id, None)
        self.controller.clear_conversation_history(drone_id)
    
    async def close(self):
        """Close LLM manager"""
        await self.controller.close()
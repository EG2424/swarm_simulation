"""
Message Router - Routes WebSocket and REST messages
Designed to be swappable with ROS 2 topics/services in future releases
"""

import json
import logging
from typing import Dict, Any, Optional

from communication.schemas import *


logger = logging.getLogger(__name__)


class MessageRouter:
    """Routes messages between clients and simulation engine"""
    
    def __init__(self):
        self.message_handlers = {
            "ping": self._handle_ping,
            "get_state": self._handle_get_state,
            "control_simulation": self._handle_control_simulation,
            "spawn_entity": self._handle_spawn_entity,
            "command_entity": self._handle_command_entity,
            "remove_entity": self._handle_remove_entity,
            "select_entity": self._handle_select_entity,
            "chat_message": self._handle_chat_message,
            "llm_request": self._handle_llm_request,
        }
    
    async def handle_message(self, message: Dict[str, Any], simulation_engine) -> Optional[Dict[str, Any]]:
        """Route incoming WebSocket message to appropriate handler"""
        try:
            message_type = message.get("type")
            data = message.get("data", {})
            
            if message_type not in self.message_handlers:
                return {
                    "type": "error",
                    "data": {"message": f"Unknown message type: {message_type}"}
                }
            
            handler = self.message_handlers[message_type]
            return await handler(data, simulation_engine)
            
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            return {
                "type": "error",
                "data": {"message": str(e)}
            }
    
    async def _handle_ping(self, data: Dict[str, Any], simulation_engine) -> Dict[str, Any]:
        """Handle ping message"""
        return {
            "type": "pong",
            "data": {"timestamp": data.get("timestamp")}
        }
    
    async def _handle_get_state(self, data: Dict[str, Any], simulation_engine) -> Dict[str, Any]:
        """Handle get state request"""
        return {
            "type": "simulation_state",
            "data": simulation_engine.get_state()
        }
    
    async def _handle_control_simulation(self, data: Dict[str, Any], simulation_engine) -> Dict[str, Any]:
        """Handle simulation control command"""
        try:
            request = SimulationControlRequest(**data)
            result = simulation_engine.handle_control_command(request)
            return {
                "type": "control_response",
                "data": result
            }
        except Exception as e:
            return {
                "type": "error",
                "data": {"message": f"Control command error: {str(e)}"}
            }
    
    async def _handle_spawn_entity(self, data: Dict[str, Any], simulation_engine) -> Dict[str, Any]:
        """Handle spawn entity request"""
        try:
            request = SpawnEntityRequest(**data)
            entity = simulation_engine.spawn_entity(request)
            return {
                "type": "entity_spawned",
                "data": entity.to_dict()
            }
        except Exception as e:
            return {
                "type": "error",
                "data": {"message": f"Spawn entity error: {str(e)}"}
            }
    
    async def _handle_command_entity(self, data: Dict[str, Any], simulation_engine) -> Dict[str, Any]:
        """Handle entity command request"""
        try:
            entity_id = data.get("entity_id")
            command_data = data.get("command", {})
            command = EntityCommandRequest(**command_data)
            
            result = simulation_engine.command_entity(entity_id, command)
            return {
                "type": "entity_command_response",
                "data": {"entity_id": entity_id, "result": result}
            }
        except Exception as e:
            return {
                "type": "error",
                "data": {"message": f"Entity command error: {str(e)}"}
            }
    
    async def _handle_remove_entity(self, data: Dict[str, Any], simulation_engine) -> Dict[str, Any]:
        """Handle remove entity request"""
        try:
            entity_id = data.get("entity_id")
            result = simulation_engine.remove_entity(entity_id)
            return {
                "type": "entity_removed",
                "data": {"entity_id": entity_id, "result": result}
            }
        except Exception as e:
            return {
                "type": "error",
                "data": {"message": f"Remove entity error: {str(e)}"}
            }
    
    async def _handle_select_entity(self, data: Dict[str, Any], simulation_engine) -> Dict[str, Any]:
        """Handle entity selection"""
        try:
            entity_id = data.get("entity_id")
            selected = data.get("selected", True)
            multi_select = data.get("multi_select", False)
            
            result = simulation_engine.select_entity(entity_id, selected, multi_select)
            return {
                "type": "entity_selection_changed",
                "data": {"entity_id": entity_id, "selected": selected}
            }
        except Exception as e:
            return {
                "type": "error",
                "data": {"message": f"Selection error: {str(e)}"}
            }
    
    async def _handle_chat_message(self, data: Dict[str, Any], simulation_engine) -> Dict[str, Any]:
        """Handle chat message"""
        try:
            message = ChatMessage(**data)
            result = simulation_engine.add_chat_message(message)
            return {
                "type": "chat_message_added",
                "data": message.dict()
            }
        except Exception as e:
            return {
                "type": "error",
                "data": {"message": f"Chat message error: {str(e)}"}
            }
    
    async def _handle_llm_request(self, data: Dict[str, Any], simulation_engine) -> Dict[str, Any]:
        """Handle LLM request"""
        try:
            request = LLMRequest(**data)
            
            # Import here to avoid circular imports
            from main import llm_manager
            
            response = await llm_manager.process_request(request, simulation_engine)
            
            # Execute any commands returned by LLM
            for command in response.commands:
                try:
                    simulation_engine.command_entity(request.drone_id, command)
                    logger.info(f"LLM commanded drone {request.drone_id}: {command.dict()}")
                except Exception as e:
                    logger.error(f"Failed to execute LLM command: {e}")
            
            return {
                "type": "llm_response",
                "data": response.dict()
            }
            
        except Exception as e:
            logger.error(f"LLM request error: {e}")
            return {
                "type": "error",
                "data": {"message": f"LLM request error: {str(e)}"}
            }
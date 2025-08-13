"""
Communication Schemas - Pydantic models for API requests/responses
Designed to be compatible with future ROS 2 message types
"""

from typing import Dict, List, Optional, Union, Any
from enum import Enum
from pydantic import BaseModel, Field


class EntityType(str, Enum):
    DRONE = "drone"
    TANK = "tank"


class DroneMode(str, Enum):
    GO_TO = "go_to"
    FOLLOW_TANK = "follow_tank"
    FOLLOW_TEAMMATE = "follow_teammate"
    RANDOM_SEARCH = "random_search"
    PATROL_ROUTE = "patrol_route"
    HOLD_POSITION = "hold_position"
    KAMIKAZE = "kamikaze"


class TankMode(str, Enum):
    GO_TO = "go_to"
    PATROL_ROUTE = "patrol_route"
    HOLD_POSITION = "hold_position"
    FLEE_TO_COVER = "flee_to_cover"
    HIDE_AND_AMBUSH = "hide_and_ambush"


class SimulationState(str, Enum):
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"


class Vector2D(BaseModel):
    x: float
    y: float


class EntityState(BaseModel):
    id: str
    type: EntityType
    position: Vector2D
    heading: float  # radians
    velocity: Vector2D
    mode: Union[DroneMode, TankMode]
    status: str  # entity-specific status
    health: float = 1.0
    detected: bool = False
    selected: bool = False
    
    # Rendering properties
    color: str
    scale: float = 1.0
    
    # Mode-specific data
    target_position: Optional[Vector2D] = None
    target_entity_id: Optional[str] = None
    patrol_route: List[Vector2D] = []
    current_waypoint: int = 0


class SimulationControlRequest(BaseModel):
    action: str  # "start", "pause", "reset", "set_speed"
    speed_multiplier: Optional[float] = None


class SpawnEntityRequest(BaseModel):
    type: EntityType
    position: Vector2D
    heading: float = 0.0
    mode: Optional[Union[DroneMode, TankMode]] = None


class EntityCommandRequest(BaseModel):
    mode: Union[DroneMode, TankMode]
    target_position: Optional[Vector2D] = None
    target_entity_id: Optional[str] = None
    patrol_route: Optional[List[Vector2D]] = None


class LoadScenarioRequest(BaseModel):
    scenario_name: str
    seed: Optional[int] = None


class ChatMessage(BaseModel):
    sender: str
    content: str
    timestamp: float
    message_type: str = "human"  # "human", "llm", "system"


class WebSocketMessage(BaseModel):
    type: str
    data: Dict[str, Any]
    client_id: Optional[str] = None


# LLM Integration Schemas
class LLMRequest(BaseModel):
    drone_id: str
    prompt: str
    context: Dict[str, Any] = {}
    stream: bool = False


class LLMResponse(BaseModel):
    drone_id: str
    response: str
    commands: List[EntityCommandRequest] = []
    timestamp: float


# Event System Schemas
class SimulationEvent(BaseModel):
    type: str
    timestamp: float
    entity_id: Optional[str] = None
    data: Dict[str, Any] = {}


class DetectionEvent(SimulationEvent):
    type: str = "detection"
    detector_id: str
    target_id: str
    distance: float


class KamikazeEvent(SimulationEvent):
    type: str = "kamikaze"
    drone_id: str
    tank_id: str


class EntityDestroyedEvent(SimulationEvent):
    type: str = "entity_destroyed"
    destroyed_id: str
    cause: str
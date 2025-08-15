"""
Simulation Engine - Core simulation loop with fixed timestep
"""

import time
import uuid
import math
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path

from communication.schemas import *
from simulation.entities import Drone, Tank, Entity
from simulation.terrain import TerrainGrid


logger = logging.getLogger(__name__)


class SimulationEngine:
    """Main simulation engine with fixed timestep and entity management"""
    
    def __init__(self, dt: float = 1.0/60.0):  # 60 FPS default
        self.dt = dt  # Fixed timestep
        self.base_dt = dt  # Base timestep for speed scaling
        self.speed_multiplier = 1.0
        self.state = SimulationState.STOPPED
        
        # World properties
        self.arena_bounds = (800.0, 600.0)  # width, height
        
        # Terrain system
        self.terrain = TerrainGrid(width=int(self.arena_bounds[0]), height=int(self.arena_bounds[1]))
        
        # Entity storage
        self.entities: Dict[str, Entity] = {}
        self.selected_entities: List[str] = []
        
        # Event system
        self.events: List[SimulationEvent] = []
        self.chat_messages: List[ChatMessage] = []
        
        # Metrics
        self.simulation_time = 0.0
        self.total_spawned = 0
        self.total_destroyed = 0
        
        # Scenario system
        self.current_scenario = None
        self.scenario_data = {}
        
        # Performance tracking
        self.last_update_time = time.time()
        self.update_count = 0
        self.fps = 0.0
        
        # Initialize with demo entities
        self._spawn_demo_entities()
        
    def get_state(self) -> Dict[str, Any]:
        """Get complete simulation state"""
        return {
            "simulation": {
                "state": self.state.value,
                "time": self.simulation_time,
                "dt": self.dt,
                "speed_multiplier": self.speed_multiplier,
                "fps": self.fps,
                "arena_bounds": {"width": self.arena_bounds[0], "height": self.arena_bounds[1]}
            },
            "entities": [entity.to_dict() for entity in self.entities.values()],
            "selected_entities": self.selected_entities,
            "metrics": {
                "total_entities": len(self.entities),
                "total_spawned": self.total_spawned,
                "total_destroyed": self.total_destroyed,
                "drones": len([e for e in self.entities.values() if isinstance(e, Drone)]),
                "tanks": len([e for e in self.entities.values() if isinstance(e, Tank)]),
                "destroyed": len([e for e in self.entities.values() if e.destroyed])
            },
            "terrain": self.terrain.to_dict(),
            "events": [event.dict() for event in self.events[-50:]],  # Last 50 events
            "chat_messages": [msg.dict() for msg in self.chat_messages[-100:]]  # Last 100 messages
        }
    
    def update(self) -> Optional[Dict[str, Any]]:
        """Main simulation update - returns delta state if changed"""
        if self.state != SimulationState.RUNNING:
            return None
            
        current_time = time.time()
        
        # Update all entities with speed-scaled timestep
        scaled_dt = self.dt * self.speed_multiplier
        for entity in self.entities.values():
            entity.update(scaled_dt, self.arena_bounds, self.entities, self.terrain)
        
        # Check for entity interactions
        self._check_interactions()
        
        # Clean up destroyed entities (after some delay)
        self._cleanup_destroyed_entities()
        
        # Update simulation time with speed scaling
        self.simulation_time += scaled_dt
        
        # Update performance metrics
        self.update_count += 1
        if current_time - self.last_update_time >= 1.0:
            self.fps = self.update_count
            self.update_count = 0
            self.last_update_time = current_time
        
        # Return delta state (for now, return full state)
        return self.get_state()
    
    def _check_interactions(self):
        """Check for entity interactions (detection, collisions)"""
        drones = [e for e in self.entities.values() if isinstance(e, Drone) and not e.destroyed]
        tanks = [e for e in self.entities.values() if isinstance(e, Tank) and not e.destroyed]
        
        # Reset tank detection states first
        for tank in tanks:
            tank.detected = False
        
        # Drone-Tank detection and engagement
        for drone in drones:
            for tank in tanks:
                distance = drone.distance_to(tank)
                
                # Detection with terrain effects
                # Calculate effective detection radius based on terrain
                drone_terrain_mult = self.terrain.get_detection_multiplier(drone.position.x, drone.position.y)
                tank_terrain_mult = self.terrain.get_detection_multiplier(tank.position.x, tank.position.y)
                avg_terrain_mult = (drone_terrain_mult + tank_terrain_mult) / 2
                
                effective_detection_radius = drone.physics.detection_radius * avg_terrain_mult
                
                # Check line of sight
                has_los = self.terrain.check_line_of_sight(
                    drone.position.x, drone.position.y,
                    tank.position.x, tank.position.y
                )
                
                if distance <= effective_detection_radius and has_los:
                    if not tank.detected:
                        tank.detected = True
                        self._add_event(DetectionEvent(
                            timestamp=self.simulation_time,
                            detector_id=drone.id,
                            target_id=tank.id,
                            distance=distance
                        ))
                    else:
                        # Tank already detected, just maintain the state
                        tank.detected = True
                
                # Kamikaze engagement (very close range)
                if distance <= 5.0 and drone.status == "engaging":
                    self._engage_kamikaze(drone, tank)
    
    def _engage_kamikaze(self, drone: Drone, tank: Tank):
        """Handle kamikaze engagement between drone and tank"""
        if not drone.destroyed and not tank.destroyed:
            drone.destroyed = True
            tank.destroyed = True
            drone.stop()
            tank.stop()
            
            self.total_destroyed += 2
            
            self._add_event(KamikazeEvent(
                timestamp=self.simulation_time,
                drone_id=drone.id,
                tank_id=tank.id,
                data={"position": {"x": drone.position.x, "y": drone.position.y}}
            ))
            
            logger.info(f"Kamikaze engagement: Drone {drone.id} destroyed Tank {tank.id}")
    
    def _cleanup_destroyed_entities(self):
        """Remove destroyed entities after delay (for visual feedback)"""
        # For now, keep destroyed entities for visual purposes
        # In future, could add cleanup timer
        pass
    
    def _add_event(self, event: SimulationEvent):
        """Add event to event log"""
        self.events.append(event)
        if len(self.events) > 1000:  # Keep last 1000 events
            self.events = self.events[-1000:]
    
    def handle_control_command(self, command: SimulationControlRequest) -> Dict[str, Any]:
        """Handle simulation control commands"""
        try:
            if command.action == "start":
                self.state = SimulationState.RUNNING
                logger.info("Simulation started")
                
            elif command.action == "pause":
                self.state = SimulationState.PAUSED
                logger.info("Simulation paused")
                
            elif command.action == "reset":
                reset_state = self._reset_simulation()
                logger.info("Simulation reset")
                # Return the empty state to trigger a broadcast
                return {"success": True, "state": self.state.value, "broadcast_state": reset_state}
                
            elif command.action == "set_speed":
                if command.speed_multiplier is not None:
                    self.speed_multiplier = max(0.1, min(20.0, command.speed_multiplier))
                    # Keep dt constant for fixed timestep, speed multiplier affects physics calculations
                    logger.info(f"Simulation speed set to {self.speed_multiplier}x")
            
            return {"success": True, "state": self.state.value}
            
        except Exception as e:
            logger.error(f"Control command error: {e}")
            return {"success": False, "error": str(e)}
    
    def spawn_entity(self, request: SpawnEntityRequest) -> Entity:
        """Spawn new entity with terrain validation"""
        # Validate spawn position based on entity type
        is_valid = self._is_valid_spawn_position(request.position.x, request.position.y, request.type)
        
        if not is_valid:
            logger.info(f"Invalid spawn position, searching for alternative...")
            # Find nearest valid position if requested position is invalid
            valid_position = self._find_nearest_valid_spawn_position(
                request.position.x, request.position.y, request.type
            )
            if not valid_position:
                error_msg = f"Cannot spawn {request.type.value} at ({request.position.x}, {request.position.y}): no valid spawn location found"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            request.position.x, request.position.y = valid_position
        
        entity_id = str(uuid.uuid4())
        
        if request.type == EntityType.DRONE:
            entity = Drone(entity_id, request.position.x, request.position.y, request.heading)
            if request.mode:
                entity.set_mode(request.mode)
        elif request.type == EntityType.TANK:
            entity = Tank(entity_id, request.position.x, request.position.y, request.heading)
            if request.mode:
                entity.set_mode(request.mode)
        else:
            raise ValueError(f"Unknown entity type: {request.type}")
        
        self.entities[entity_id] = entity
        self.total_spawned += 1
        
        return entity
    
    def command_entity(self, entity_id: str, command: EntityCommandRequest) -> Dict[str, Any]:
        """Send command to entity"""
        if entity_id not in self.entities:
            raise ValueError(f"Entity {entity_id} not found")
        
        entity = self.entities[entity_id]
        
        try:
            if isinstance(entity, Drone):
                entity.set_mode(
                    command.mode,
                    target_position=command.target_position,
                    target_entity_id=command.target_entity_id,
                    patrol_route=command.patrol_route or []
                )
            elif isinstance(entity, Tank):
                entity.set_mode(
                    command.mode,
                    target_position=command.target_position,
                    patrol_route=command.patrol_route or []
                )
            
            logger.info(f"Commanded {entity.type.value} {entity_id} to {command.mode.value}")
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Entity command error: {e}")
            return {"success": False, "error": str(e)}
    
    def remove_entity(self, entity_id: str) -> Dict[str, Any]:
        """Remove entity from simulation"""
        if entity_id not in self.entities:
            return {"success": False, "error": "Entity not found"}
        
        entity = self.entities.pop(entity_id)
        
        # Remove from selection
        if entity_id in self.selected_entities:
            self.selected_entities.remove(entity_id)
        
        # Add destruction event
        self._add_event(EntityDestroyedEvent(
            timestamp=self.simulation_time,
            entity_id=entity_id,
            destroyed_id=entity_id,
            cause="removed"
        ))
        
        logger.info(f"Removed {entity.type.value} {entity_id}")
        return {"success": True}
    
    def select_entity(self, entity_id: str, selected: bool = True, multi_select: bool = False) -> Dict[str, Any]:
        """Handle entity selection"""
        if entity_id not in self.entities:
            return {"success": False, "error": "Entity not found"}
        
        entity = self.entities[entity_id]
        
        if not multi_select:
            # Clear previous selections
            for eid in self.selected_entities:
                if eid in self.entities:
                    self.entities[eid].selected = False
            self.selected_entities.clear()
        
        if selected:
            if entity_id not in self.selected_entities:
                self.selected_entities.append(entity_id)
            entity.selected = True
        else:
            if entity_id in self.selected_entities:
                self.selected_entities.remove(entity_id)
            entity.selected = False
        
        return {"success": True, "selected_count": len(self.selected_entities)}
    
    def add_chat_message(self, message: ChatMessage) -> Dict[str, Any]:
        """Add message to chat log"""
        message.timestamp = self.simulation_time
        self.chat_messages.append(message)
        
        # Keep last 500 messages
        if len(self.chat_messages) > 500:
            self.chat_messages = self.chat_messages[-500:]
        
        return {"success": True}
    
    def list_scenarios(self) -> Dict[str, Any]:
        """List available scenarios"""
        scenarios_dir = Path("scenarios")
        scenarios = []
        
        if scenarios_dir.exists():
            for file_path in scenarios_dir.glob("*.json"):
                try:
                    with open(file_path, 'r') as f:
                        scenario_data = json.load(f)
                        scenarios.append({
                            "name": file_path.stem,
                            "title": scenario_data.get("title", file_path.stem),
                            "description": scenario_data.get("description", ""),
                            "entities": len(scenario_data.get("entities", []))
                        })
                except Exception as e:
                    logger.error(f"Error loading scenario {file_path}: {e}")
        
        return {"scenarios": scenarios}
    
    def load_scenario(self, request: LoadScenarioRequest) -> Dict[str, Any]:
        """Load scenario from file"""
        scenario_path = Path("scenarios") / f"{request.scenario_name}.json"
        
        if not scenario_path.exists():
            return {"success": False, "error": "Scenario file not found"}
        
        try:
            with open(scenario_path, 'r') as f:
                scenario_data = json.load(f)
            
            # Reset simulation
            self._reset_simulation()
            
            # Set arena bounds if specified
            if "arena" in scenario_data:
                arena = scenario_data["arena"]
                self.arena_bounds = (arena.get("width", 800), arena.get("height", 600))
            
            # Always reset terrain when loading a scenario
            if "terrain" in scenario_data:
                # Load scenario-specific terrain
                terrain_data = scenario_data["terrain"]
                logger.info(f"Loading terrain data: {len(terrain_data.get('grid', []))} rows")
                success = self.terrain.from_dict(terrain_data)
                if success:
                    logger.info(f"Successfully loaded terrain with {len(terrain_data.get('terrain_definitions', {}))} terrain types")
                else:
                    logger.error("Failed to load terrain data")
                    # Fall back to default terrain if scenario terrain fails
                    self.terrain.reset_to_default()
                    logger.info("Reset to default terrain after terrain loading failure")
            else:
                # Reset to default terrain for scenarios without terrain data
                self.terrain.reset_to_default()
                logger.info("Reset to default terrain (no terrain data in scenario)")
            
            # Spawn entities
            for entity_data in scenario_data.get("entities", []):
                spawn_request = SpawnEntityRequest(
                    type=EntityType(entity_data["type"]),
                    position=Vector2D(x=entity_data["x"], y=entity_data["y"]),
                    heading=entity_data.get("heading", 0.0)
                )
                
                entity = self.spawn_entity(spawn_request)
                
                # Set entity properties
                if "mode" in entity_data:
                    if entity_data["type"] == "drone":
                        mode = DroneMode(entity_data["mode"])
                    else:
                        mode = TankMode(entity_data["mode"])
                    
                    command = EntityCommandRequest(
                        mode=mode,
                        target_position=Vector2D(
                            x=entity_data["target_x"], y=entity_data["target_y"]
                        ) if "target_x" in entity_data else None,
                        patrol_route=[
                            Vector2D(x=p["x"], y=p["y"]) for p in entity_data.get("patrol_route", [])
                        ]
                    )
                    
                    self.command_entity(entity.id, command)
            
            self.current_scenario = request.scenario_name
            self.scenario_data = scenario_data
            
            logger.info(f"Loaded scenario: {request.scenario_name}")
            return {"success": True, "entities_loaded": len(scenario_data.get("entities", []))}
            
        except Exception as e:
            logger.error(f"Error loading scenario: {e}")
            return {"success": False, "error": str(e)}
    
    def _reset_simulation(self):
        """Reset simulation to initial state"""
        self.state = SimulationState.STOPPED
        self.entities.clear()
        self.selected_entities.clear()
        self.events.clear()
        self.chat_messages.clear()
        self.simulation_time = 0.0
        self.total_spawned = 0
        self.total_destroyed = 0
        self.current_scenario = None
        self.scenario_data = {}
        
        logger.info("Simulation reset")
        
        # Return state data to force a broadcast update with empty entities
        return self.get_state()
    
    def _spawn_demo_entities(self):
        """Spawn some demo entities for initial demonstration using proper validation"""
        try:
            # Spawn 2 drones using the proper spawn system
            try:
                drone1_request = SpawnEntityRequest(
                    type=EntityType.DRONE,
                    position=Vector2D(x=150, y=100),
                    mode=DroneMode.RANDOM_SEARCH
                )
                self.spawn_entity(drone1_request)
            except Exception as e:
                logger.warning(f"Could not spawn demo drone 1: {e}")
            
            try:
                drone2_request = SpawnEntityRequest(
                    type=EntityType.DRONE,
                    position=Vector2D(x=650, y=100),
                    mode=DroneMode.RANDOM_SEARCH
                )
                self.spawn_entity(drone2_request)
            except Exception as e:
                logger.warning(f"Could not spawn demo drone 2: {e}")
            
            # Spawn 2 tanks in safe locations using proper validation
            try:
                tank1_request = SpawnEntityRequest(
                    type=EntityType.TANK,
                    position=Vector2D(x=100, y=100),  # Safe open area
                    mode=TankMode.WAYPOINT_MODE
                )
                tank1 = self.spawn_entity(tank1_request)
                # Set patrol route after spawning
                tank1.patrol_route = [
                    Vector2D(x=80, y=80),
                    Vector2D(x=120, y=80),
                    Vector2D(x=120, y=120),
                    Vector2D(x=80, y=120)
                ]
            except Exception as e:
                logger.warning(f"Could not spawn demo tank 1: {e}")
            
            try:
                tank2_request = SpawnEntityRequest(
                    type=EntityType.TANK,
                    position=Vector2D(x=700, y=500),  # Safe open area
                    mode=TankMode.HIDE_AND_AMBUSH
                )
                self.spawn_entity(tank2_request)
            except Exception as e:
                logger.warning(f"Could not spawn demo tank 2: {e}")
            
            logger.info(f"Spawned {len(self.entities)} demo entities using proper validation")
            
        except Exception as e:
            logger.error(f"Error spawning demo entities: {e}")
    
    def _is_valid_spawn_position(self, x: float, y: float, entity_type: EntityType) -> bool:
        """Check if a position is valid for spawning the given entity type"""
        # Check if terrain system is initialized
        if not self.terrain:
            logger.error("ERROR: Terrain system not initialized!")
            return True  # Allow spawn if no terrain system
        
        # Check arena bounds
        if x < 0 or y < 0 or x >= self.arena_bounds[0] or y >= self.arena_bounds[1]:
            return False
        
        # Check terrain constraints
        entity_type_str = entity_type.value
        
        # Drones can spawn anywhere within bounds (they can fly)
        if entity_type == EntityType.DRONE:
            return True
        
        # Tanks cannot spawn in blocked terrain (water, etc.)
        if entity_type == EntityType.TANK:
            try:
                # Get the terrain at this position
                terrain_info = self.terrain.get_terrain_at(x, y)
                is_blocked = self.terrain.is_blocked(x, y, entity_type_str)
                move_cost = self.terrain.get_movement_cost(x, y, entity_type_str)
                
                if is_blocked:
                    return False
                
                # Also check if terrain has very high movement cost (effectively impassable)
                if move_cost > 5.0:  # Arbitrary threshold for "too difficult to spawn in"
                    return False
                    
            except Exception as e:
                logger.error(f"ERROR during terrain check: {e}")
                return False
        
        # Check for collision with existing entities
        collision_radius = 15.0  # Minimum distance from other entities
        for entity in self.entities.values():
            if not entity.destroyed:
                distance = math.sqrt((x - entity.position.x)**2 + (y - entity.position.y)**2)
                if distance < collision_radius:
                    return False
        
        return True
    
    def _find_nearest_valid_spawn_position(self, x: float, y: float, entity_type: EntityType, max_search_radius: float = 100.0) -> Optional[Tuple[float, float]]:
        """Find the nearest valid spawn position within search radius"""
        # Try positions in expanding circles around the requested position
        search_step = 10.0
        
        for radius in range(int(search_step), int(max_search_radius), int(search_step)):
            # Try 8 positions around the circle
            for angle_step in range(0, 360, 45):
                angle = math.radians(angle_step)
                test_x = x + radius * math.cos(angle)
                test_y = y + radius * math.sin(angle)
                
                if self._is_valid_spawn_position(test_x, test_y, entity_type):
                    return (test_x, test_y)
        
        # If no valid position found in search radius, try some fallback positions
        # Try corners of the arena (usually safe)
        fallback_positions = [
            (50, 50),  # Top-left
            (self.arena_bounds[0] - 50, 50),  # Top-right
            (50, self.arena_bounds[1] - 50),  # Bottom-left
            (self.arena_bounds[0] - 50, self.arena_bounds[1] - 50),  # Bottom-right
            (self.arena_bounds[0] / 2, 50),  # Top-center
            (self.arena_bounds[0] / 2, self.arena_bounds[1] - 50),  # Bottom-center
        ]
        
        for test_x, test_y in fallback_positions:
            if self._is_valid_spawn_position(test_x, test_y, entity_type):
                return (test_x, test_y)
        
        return None
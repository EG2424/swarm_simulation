"""
Entity System - Drones and Tanks with kinematics and behaviors
"""

import math
import random
import time
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum

from communication.schemas import *


@dataclass
class Physics:
    """Physical properties and constraints for entities"""
    max_speed: float = 5.0
    max_angular_velocity: float = math.pi  # rad/s
    detection_radius: float = 50.0
    collision_radius: float = 3.0


class Entity(ABC):
    """Base entity class with unicycle kinematics"""
    
    def __init__(self, entity_id: str, entity_type: EntityType, x: float, y: float, heading: float = 0.0):
        self.id = entity_id
        self.type = entity_type
        self.position = Vector2D(x=x, y=y)
        self.heading = heading  # radians
        self.velocity = Vector2D(x=0.0, y=0.0)
        self.physics = Physics()
        
        # State
        self.health = 1.0
        self.detected = False
        self.selected = False
        self.destroyed = False
        
        # Control
        self.target_position: Optional[Vector2D] = None
        self.target_entity_id: Optional[str] = None
        self.patrol_route: List[Vector2D] = []
        self.current_waypoint = 0
        
        # Rendering
        self.color = "#FFFFFF"
        self.scale = 1.0
        
        # Timing
        self.last_update = time.time()
        
    def update(self, dt: float, arena_bounds: Tuple[float, float], entities: Dict[str, 'Entity'], terrain=None):
        """Update entity state with fixed timestep"""
        current_time = time.time()
        
        # Update behavior
        self._update_behavior(dt, entities)
        
        # Apply physics with collision avoidance
        self._update_physics(dt, arena_bounds, terrain, entities)
        
        # Update visual state
        self._update_visual_state()
        
        self.last_update = current_time
    
    def _update_physics(self, dt: float, arena_bounds: Tuple[float, float], terrain=None, entities: Dict[str, 'Entity'] = None):
        """Apply unicycle kinematics and constraints with collision avoidance"""
        # Skip physics updates for destroyed entities
        if self.destroyed:
            return
            
        # Calculate speed from velocity magnitude
        speed = math.sqrt(self.velocity.x**2 + self.velocity.y**2)
        
        if speed > 0:
            # Calculate new position
            new_x = self.position.x
            new_y = self.position.y
            
            # Apply terrain movement cost
            effective_dt = dt
            if terrain:
                move_cost = terrain.get_movement_cost(self.position.x, self.position.y, self.type.value)
                effective_dt = dt / move_cost  # Higher cost = slower movement
                
                # Check if blocked
                if terrain.is_blocked(self.position.x, self.position.y, self.type.value):
                    effective_dt = 0  # Can't move at all
            
            if effective_dt > 0:
                # Calculate proposed new position
                new_x = self.position.x + self.velocity.x * effective_dt
                new_y = self.position.y + self.velocity.y * effective_dt
                
                # Check for collisions with other entities
                if entities:
                    collision_detected = False
                    for other_id, other_entity in entities.items():
                        if other_id != self.id and not other_entity.destroyed:
                            # Calculate distance to other entity at new position
                            dx = new_x - other_entity.position.x
                            dy = new_y - other_entity.position.y
                            distance = math.sqrt(dx*dx + dy*dy)
                            
                            # Check collision (combined collision radii)
                            min_distance = self.physics.collision_radius + other_entity.physics.collision_radius
                            if distance < min_distance:
                                collision_detected = True
                                # Apply separation force to avoid overlap
                                if distance > 0:
                                    # Push away from other entity
                                    push_strength = (min_distance - distance) / min_distance
                                    push_x = (dx / distance) * push_strength * 2.0
                                    push_y = (dy / distance) * push_strength * 2.0
                                    new_x += push_x
                                    new_y += push_y
                                else:
                                    # Entities are exactly on top of each other, random separation
                                    angle = random.random() * 2 * math.pi
                                    new_x += math.cos(angle) * min_distance
                                    new_y += math.sin(angle) * min_distance
                    
                    # If collision detected, reduce movement to prevent overlap
                    if collision_detected:
                        # Blend between original movement and collision avoidance
                        blend = 0.3  # How much of original movement to keep
                        new_x = self.position.x * (1 - blend) + new_x * blend
                        new_y = self.position.y * (1 - blend) + new_y * blend
                
                # Update position
                self.position.x = new_x
                self.position.y = new_y
                
                # Update heading based on velocity direction
                self.heading = math.atan2(self.velocity.y, self.velocity.x)
        
        # Static collision resolution (even when not moving)
        if entities:
            for other_id, other_entity in entities.items():
                if other_id != self.id and not other_entity.destroyed:
                    # Calculate current distance
                    dx = self.position.x - other_entity.position.x
                    dy = self.position.y - other_entity.position.y
                    distance = math.sqrt(dx*dx + dy*dy)
                    
                    # Check if entities are overlapping
                    min_distance = self.physics.collision_radius + other_entity.physics.collision_radius
                    if distance < min_distance:
                        if distance > 0.1:  # Avoid division by zero
                            # Calculate separation needed
                            separation_needed = min_distance - distance
                            # Each entity moves half the separation distance
                            move_distance = separation_needed * 0.5
                            
                            # Normalize direction and apply separation
                            dx_norm = dx / distance
                            dy_norm = dy / distance
                            
                            # Move this entity away from the other
                            self.position.x += dx_norm * move_distance
                            self.position.y += dy_norm * move_distance
                        else:
                            # Entities are exactly on top of each other, random separation
                            angle = random.random() * 2 * math.pi
                            self.position.x += math.cos(angle) * min_distance * 0.5
                            self.position.y += math.sin(angle) * min_distance * 0.5
        
        # Apply arena bounds
        width, height = arena_bounds
        self.position.x = max(self.physics.collision_radius, 
                             min(width - self.physics.collision_radius, self.position.x))
        self.position.y = max(self.physics.collision_radius,
                             min(height - self.physics.collision_radius, self.position.y))
    
    @abstractmethod
    def _update_behavior(self, dt: float, entities: Dict[str, 'Entity']):
        """Update entity-specific behavior"""
        pass
    
    @abstractmethod
    def _update_visual_state(self):
        """Update visual appearance based on state"""
        pass
    
    def distance_to(self, other: 'Entity') -> float:
        """Calculate distance to another entity"""
        dx = self.position.x - other.position.x
        dy = self.position.y - other.position.y
        return math.sqrt(dx*dx + dy*dy)
    
    def distance_to_point(self, point: Vector2D) -> float:
        """Calculate distance to a point"""
        dx = self.position.x - point.x
        dy = self.position.y - point.y
        return math.sqrt(dx*dx + dy*dy)
    
    def angle_to(self, target: Vector2D) -> float:
        """Calculate angle to target point"""
        dx = target.x - self.position.x
        dy = target.y - self.position.y
        return math.atan2(dy, dx)
    
    def move_towards(self, target: Vector2D, speed: float = None):
        """Set velocity to move towards target"""
        if speed is None:
            speed = self.physics.max_speed
            
        distance = self.distance_to_point(target)
        if distance > 0:
            dx = target.x - self.position.x
            dy = target.y - self.position.y
            
            # Normalize and scale by speed
            self.velocity.x = (dx / distance) * speed
            self.velocity.y = (dy / distance) * speed
        else:
            self.velocity.x = 0
            self.velocity.y = 0
    
    def stop(self):
        """Stop moving"""
        self.velocity.x = 0
        self.velocity.y = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert entity to dictionary for serialization"""
        base_dict = {
            "id": self.id,
            "type": self.type.value,
            "position": {"x": self.position.x, "y": self.position.y},
            "heading": self.heading,
            "velocity": {"x": self.velocity.x, "y": self.velocity.y},
            "health": self.health,
            "detected": self.detected,
            "selected": self.selected,
            "destroyed": self.destroyed,
            "color": self.color,
            "scale": self.scale,
            "target_position": {
                "x": self.target_position.x, "y": self.target_position.y
            } if self.target_position else None,
            "target_entity_id": self.target_entity_id,
            "patrol_route": [{"x": p.x, "y": p.y} for p in self.patrol_route],
            "current_waypoint": self.current_waypoint,
            "mode": self.mode.value if hasattr(self.mode, 'value') else str(self.mode),
            "status": getattr(self, 'status', 'unknown')
        }
        
        # Add drone-specific fields
        if isinstance(self, Drone):
            base_dict.update({
                "kamikaze_enabled": getattr(self, 'kamikaze_enabled', True),
                "kamikaze_target": getattr(self, 'kamikaze_target', None),
                "kamikaze_impact_position": {
                    "x": self.kamikaze_impact_position.x, "y": self.kamikaze_impact_position.y
                } if getattr(self, 'kamikaze_impact_position', None) else None
            })
        
        # Add kamikaze impact position for tanks too (in case they were hit by kamikaze)
        if hasattr(self, 'kamikaze_impact_position') and self.kamikaze_impact_position:
            base_dict["kamikaze_impact_position"] = {
                "x": self.kamikaze_impact_position.x, "y": self.kamikaze_impact_position.y
            }
            
        return base_dict


class Drone(Entity):
    """Drone entity with delta wing shape and AI behaviors"""
    
    def __init__(self, entity_id: str, x: float, y: float, heading: float = 0.0):
        super().__init__(entity_id, EntityType.DRONE, x, y, heading)
        self.mode = DroneMode.RANDOM_SEARCH
        self.status = "idle"  # idle, tracking, engaging
        self.physics.max_speed = 8.0
        self.physics.detection_radius = 40.0
        
        # Behavior state
        self.search_target: Optional[Vector2D] = None
        self.search_timer = 0.0
        self.engage_timer = 0.0
        
        # Kamikaze settings
        self.kamikaze_enabled = True  # Can be toggled via GUI
        self.kamikaze_target: Optional[str] = None
        self.kamikaze_impact_position: Optional[Vector2D] = None  # Position where kamikaze impact occurred
        
    def _update_behavior(self, dt: float, entities: Dict[str, Entity]):
        """Update drone AI behavior"""
        if self.destroyed:
            self.stop()
            return
            
        if self.mode == DroneMode.FOLLOW_TANK:
            self._behavior_follow_tank(dt, entities)
        elif self.mode == DroneMode.FOLLOW_TEAMMATE:
            self._behavior_follow_teammate(dt, entities)
        elif self.mode == DroneMode.RANDOM_SEARCH:
            self._behavior_random_search(dt, entities)
        elif self.mode == DroneMode.WAYPOINT_MODE or self.mode == "patrol_route":
            self._behavior_waypoint_mode(dt, entities)
        elif self.mode == DroneMode.HOLD_POSITION:
            self._behavior_hold_position(dt)
        elif self.mode == DroneMode.KAMIKAZE:
            self._behavior_kamikaze(dt, entities)
    
    
    def _behavior_follow_tank(self, dt: float, entities: Dict[str, Entity]):
        """Follow specific tank"""
        if self.target_entity_id and self.target_entity_id in entities:
            target = entities[self.target_entity_id]
            if isinstance(target, Tank) and not target.destroyed:
                if self.distance_to(target) > 15.0:
                    self.move_towards(target.position)
                    self.status = "following"
                else:
                    self.stop()
                    self.status = "tracking"
            else:
                self.mode = DroneMode.RANDOM_SEARCH
                self.status = "searching"
        else:
            self.mode = DroneMode.RANDOM_SEARCH
            self.status = "searching"
    
    def _behavior_follow_teammate(self, dt: float, entities: Dict[str, Entity]):
        """Follow another drone"""
        if self.target_entity_id and self.target_entity_id in entities:
            target = entities[self.target_entity_id]
            if isinstance(target, Drone) and not target.destroyed:
                if self.distance_to(target) > 20.0:
                    self.move_towards(target.position)
                    self.status = "following"
                else:
                    self.stop()
                    self.status = "formation"
            else:
                self.mode = DroneMode.RANDOM_SEARCH
                self.status = "searching"
        else:
            self.mode = DroneMode.RANDOM_SEARCH
            self.status = "searching"
    
    def _behavior_random_search(self, dt: float, entities: Dict[str, Entity]):
        """Random search pattern with tank detection"""
        # Check for nearby tanks
        for entity in entities.values():
            if isinstance(entity, Tank) and not entity.destroyed:
                if self.distance_to(entity) <= self.physics.detection_radius:
                    entity.detected = True
                    self.status = "tracking"
                    self.engage_timer += dt
                    
                    # Kamikaze after tracking for 1.5 seconds (only if enabled)
                    if self.engage_timer >= 1.5 and self.kamikaze_enabled:
                        # Execute kamikaze attack
                        self._engage_kamikaze(entity)
                        return
                    else:
                        # Move closer to target
                        self.move_towards(entity.position, self.physics.max_speed * 0.7)
                        return
        
        # Continue search pattern
        self.engage_timer = 0.0
        self.status = "searching"
        
        self.search_timer += dt
        if self.search_timer >= 3.0 or not self.search_target:
            # Pick new search location
            self.search_timer = 0.0
            self.search_target = Vector2D(
                x=random.uniform(50, 750),
                y=random.uniform(50, 550)
            )
        
        if self.search_target:
            if self.distance_to_point(self.search_target) > 5.0:
                self.move_towards(self.search_target)
            else:
                self.search_target = None
    
    def _behavior_waypoint_mode(self, dt: float, entities: Dict[str, Entity]):
        """Move along defined waypoint route with tank detection and engagement"""
        # Check for nearby tanks first (same as random search)
        for entity in entities.values():
            if isinstance(entity, Tank) and not entity.destroyed:
                if self.distance_to(entity) <= self.physics.detection_radius:
                    entity.detected = True
                    self.status = "tracking"
                    self.engage_timer += dt
                    
                    # Kamikaze after tracking for 1.5 seconds (only if enabled)
                    if self.engage_timer >= 1.5 and self.kamikaze_enabled:
                        # Execute kamikaze attack
                        self._engage_kamikaze(entity)
                        return
                    else:
                        # Move closer to target instead of following waypoint
                        self.move_towards(entity.position, self.physics.max_speed * 0.7)
                        return
        
        # No tanks detected, continue waypoint navigation
        self.engage_timer = 0.0
        if not self.patrol_route:
            self.stop()
            self.status = "idle"
            return
            
        current_target = self.patrol_route[self.current_waypoint]
        if self.distance_to_point(current_target) <= 5.0:
            self.current_waypoint = (self.current_waypoint + 1) % len(self.patrol_route)
            current_target = self.patrol_route[self.current_waypoint]
        
        self.move_towards(current_target)
        self.status = "patrolling"
    
    def _behavior_hold_position(self, dt: float):
        """Hold current position"""
        self.stop()
        self.status = "holding"
    
    def _behavior_kamikaze(self, dt: float, entities: Dict[str, Entity]):
        """Dedicated kamikaze mode - actively hunt for targets"""
        # Find nearest tank to attack
        nearest_tank = None
        min_distance = float('inf')
        
        for entity in entities.values():
            if isinstance(entity, Tank) and not entity.destroyed:
                distance = self.distance_to(entity)
                if distance < min_distance:
                    min_distance = distance
                    nearest_tank = entity
        
        if nearest_tank:
            self.kamikaze_target = nearest_tank.id
            self.status = "engaging"
            
            # Move directly toward target at max speed
            self.move_towards(nearest_tank.position, self.physics.max_speed)
            
            # Engage kamikaze when very close
            if min_distance <= 8.0:
                self._engage_kamikaze(nearest_tank)
                return
                
        else:
            # No tanks found, search for them
            self.status = "hunting"
            if not self.search_target or self.distance_to_point(self.search_target) < 10.0:
                # Pick new search location
                self.search_target = Vector2D(
                    x=random.uniform(50, 750),
                    y=random.uniform(50, 550)
                )
            
            if self.search_target:
                self.move_towards(self.search_target)
    
    def _engage_kamikaze(self, target: 'Tank'):
        """Engage kamikaze attack on target tank"""
        print(f"KAMIKAZE: Before - Drone at ({self.position.x:.1f}, {self.position.y:.1f}), Tank at ({target.position.x:.1f}, {target.position.y:.1f})")
        
        self.status = "engaging"
        target.status = "destroyed"
        
        # Impact position is the tank's position (drone crashes into tank)
        impact_x = target.position.x
        impact_y = target.position.y
        impact_pos = Vector2D(x=impact_x, y=impact_y)
        
        # Stop movement first to prevent any further physics updates
        self.velocity.x = 0
        self.velocity.y = 0
        target.velocity.x = 0
        target.velocity.y = 0
        
        # Set kamikaze impact position for both entities
        self.kamikaze_impact_position = impact_pos
        target.kamikaze_impact_position = impact_pos
        
        # Move drone to tank's position (tank stays where it is)
        self.position.x = impact_x
        self.position.y = impact_y
        # Tank position remains unchanged
        
        # Destroy both entities LAST
        self.destroyed = True
        target.destroyed = True
        
        print(f"KAMIKAZE: After - Drone at ({self.position.x:.1f}, {self.position.y:.1f}), Tank at ({target.position.x:.1f}, {target.position.y:.1f})")
        print(f"KAMIKAZE: Impact position set to ({impact_x:.1f}, {impact_y:.1f})")
        print(f"KAMIKAZE: Drone destroyed={self.destroyed}, Tank destroyed={target.destroyed}")
    
    def _update_visual_state(self):
        """Update drone color based on status"""
        if self.destroyed:
            self.color = "#666666"  # Grey
        elif self.status == "engaging":
            self.color = "#FF0000"  # Red - engaging/kamikaze
        elif self.status == "hunting":
            self.color = "#FF6600"  # Orange - hunting for kamikaze
        elif self.status == "tracking":
            self.color = "#FFFF00"  # Yellow - tracking target
        elif self.mode == DroneMode.KAMIKAZE and self.kamikaze_enabled:
            self.color = "#FF3300"  # Dark red - kamikaze mode enabled
        elif not self.kamikaze_enabled:
            self.color = "#00CCFF"  # Cyan - kamikaze disabled
        else:
            self.color = "#00FF00"  # Green - idle/search
    
    def set_mode(self, mode: DroneMode, **kwargs):
        """Set drone mode and parameters"""
        self.mode = mode
        
        if mode == DroneMode.FOLLOW_TANK or mode == DroneMode.FOLLOW_TEAMMATE:
            self.target_entity_id = kwargs.get('target_entity_id')
        elif mode == DroneMode.WAYPOINT_MODE or mode == "patrol_route":
            # Support both new and old parameter names for backward compatibility
            waypoint_route = kwargs.get('waypoint_route') or kwargs.get('patrol_route')
            if waypoint_route is not None:
                self.patrol_route = waypoint_route
            self.current_waypoint = 0


class Tank(Entity):
    """Tank entity with square shape and defensive behaviors"""
    
    def __init__(self, entity_id: str, x: float, y: float, heading: float = 0.0):
        super().__init__(entity_id, EntityType.TANK, x, y, heading)
        self.mode = TankMode.WAYPOINT_MODE
        self.status = "idle"  # idle, moving, engaging, destroyed
        self.physics.max_speed = 3.0
        self.physics.detection_radius = 30.0
        
        # Behavior state
        self.patrol_timer = 0.0
        self.flee_timer = 0.0
        self.detected_by_drone = False
        self.kamikaze_impact_position: Optional[Vector2D] = None  # Position where kamikaze impact occurred
        
        # Default patrol route (small square)
        self.patrol_route = [
            Vector2D(x=x-20, y=y-20),
            Vector2D(x=x+20, y=y-20),
            Vector2D(x=x+20, y=y+20),
            Vector2D(x=x-20, y=y+20),
        ]
    
    def _update_behavior(self, dt: float, entities: Dict[str, Entity]):
        """Update tank AI behavior"""
        if self.destroyed:
            self.stop()
            self.status = "destroyed"
            return
            
        # Check if detected by drones
        self.detected_by_drone = False
        for entity in entities.values():
            if isinstance(entity, Drone) and not entity.destroyed:
                if self.distance_to(entity) <= entity.physics.detection_radius:
                    self.detected_by_drone = True
                    break
        
        if self.mode == TankMode.WAYPOINT_MODE or self.mode == "patrol_route":
            self._behavior_waypoint_mode(dt, entities)
        elif self.mode == TankMode.HOLD_POSITION:
            self._behavior_hold_position(dt)
        elif self.mode == TankMode.FLEE_TO_COVER:
            self._behavior_flee_to_cover(dt, entities)
        elif self.mode == TankMode.HIDE_AND_AMBUSH:
            self._behavior_hide_and_ambush(dt, entities)
    
    
    def _behavior_waypoint_mode(self, dt: float, entities: Dict[str, Entity]):
        """Move along waypoint route, with drone avoidance"""
        if self.detected_by_drone:
            # Flee behavior when detected
            self._flee_from_drones(entities)
            return
            
        if not self.patrol_route:
            self.stop()
            return
            
        current_target = self.patrol_route[self.current_waypoint]
        if self.distance_to_point(current_target) <= 3.0:
            self.current_waypoint = (self.current_waypoint + 1) % len(self.patrol_route)
            current_target = self.patrol_route[self.current_waypoint]
        
        self.move_towards(current_target, self.physics.max_speed * 0.6)
        self.status = "patrolling"
    
    def _behavior_hold_position(self, dt: float):
        """Hold current position"""
        self.stop()
        self.status = "holding"
    
    def _behavior_flee_to_cover(self, dt: float, entities: Dict[str, Entity]):
        """Flee to cover when detected"""
        if self.detected_by_drone:
            self._flee_from_drones(entities)
        else:
            self.stop()
            self.status = "hiding"
    
    def _behavior_hide_and_ambush(self, dt: float, entities: Dict[str, Entity]):
        """Hide and wait for ambush opportunity"""
        if self.detected_by_drone:
            self._flee_from_drones(entities)
        else:
            # Stay still and hidden
            self.stop()
            self.status = "ambush"
    
    def _flee_from_drones(self, entities: Dict[str, Entity]):
        """Flee from nearby drones"""
        nearest_drone = None
        min_distance = float('inf')
        
        for entity in entities.values():
            if isinstance(entity, Drone) and not entity.destroyed:
                distance = self.distance_to(entity)
                if distance < min_distance:
                    min_distance = distance
                    nearest_drone = entity
        
        if nearest_drone:
            # Move away from nearest drone
            escape_angle = self.angle_to(nearest_drone.position) + math.pi  # Opposite direction
            escape_distance = 100.0
            
            escape_x = self.position.x + math.cos(escape_angle) * escape_distance
            escape_y = self.position.y + math.sin(escape_angle) * escape_distance
            
            # Clamp to arena bounds
            escape_x = max(50, min(750, escape_x))
            escape_y = max(50, min(550, escape_y))
            
            escape_target = Vector2D(x=escape_x, y=escape_y)
            self.move_towards(escape_target, self.physics.max_speed)
            self.status = "fleeing"
    
    def _update_visual_state(self):
        """Update tank color based on detection state"""
        if self.destroyed:
            self.color = "#666666"  # Grey - destroyed
        elif self.detected_by_drone or self.detected:
            self.color = "#0066FF"  # Blue - discovered
        else:
            self.color = "#FF0000"  # Red - not discovered
    
    def set_mode(self, mode: TankMode, **kwargs):
        """Set tank mode and parameters"""
        self.mode = mode
        
        if mode == TankMode.WAYPOINT_MODE or mode == "patrol_route":
            # Support both new and old parameter names for backward compatibility
            waypoint_route = kwargs.get('waypoint_route') or kwargs.get('patrol_route')
            if waypoint_route is not None:
                self.patrol_route = waypoint_route
            self.current_waypoint = 0
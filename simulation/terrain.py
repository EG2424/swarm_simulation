"""
Terrain System - Grid-based terrain with movement and detection effects
"""

import json
import math
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
from dataclasses import dataclass
from pathlib import Path

from communication.schemas import Vector2D


class TerrainType(Enum):
    """Terrain type definitions"""
    OPEN = "open"
    FOREST = "forest"
    RUINS = "ruins"  # Urban/Ruins
    WATER = "water"
    ROAD = "road"
    BRIDGE = "bridge"


@dataclass
class TerrainDefinition:
    """Terrain type definition with effects"""
    id: str
    name: str
    color: str
    move_cost: float = 1.0  # Movement speed multiplier (1.0 = normal, 2.0 = half speed)
    blocked: bool = False   # Completely blocks movement for tanks
    detect_mult: float = 1.0  # Detection radius multiplier
    los_blocks: bool = False  # Blocks line of sight
    description: str = ""


class TerrainGrid:
    """Grid-based terrain system"""
    
    def __init__(self, width: int = 800, height: int = 600, cell_size: int = 20):
        self.width = width
        self.height = height
        self.cell_size = cell_size
        
        # Grid dimensions
        self.grid_width = width // cell_size
        self.grid_height = height // cell_size
        
        # Terrain definitions
        self.terrain_defs: Dict[str, TerrainDefinition] = {}
        self._init_default_terrain_types()
        
        # Grid data - stores terrain type id for each cell
        self.grid: List[List[str]] = []
        self._init_grid()
        
    def _init_default_terrain_types(self):
        """Initialize default terrain type definitions"""
        self.terrain_defs = {
            TerrainType.OPEN.value: TerrainDefinition(
                id=TerrainType.OPEN.value,
                name="Open Ground",
                color="#2c3e50",  # Modern dark blue-gray
                move_cost=1.0,
                blocked=False,
                detect_mult=1.0,
                los_blocks=False,
                description="Open terrain with normal movement and detection"
            ),
            TerrainType.FOREST.value: TerrainDefinition(
                id=TerrainType.FOREST.value,
                name="Forest",
                color="#27ae60",  # Modern green
                move_cost=1.5,
                blocked=False,
                detect_mult=0.7,
                los_blocks=True,
                description="Dense forest - slower movement, reduced detection"
            ),
            TerrainType.RUINS.value: TerrainDefinition(
                id=TerrainType.RUINS.value,
                name="Ruins/Urban",
                color="#95a5a6",  # Modern gray for ruins
                move_cost=1.3,
                blocked=False,
                detect_mult=0.8,
                los_blocks=True,
                description="Urban ruins - corridors and LoS blocking"
            ),
            TerrainType.WATER.value: TerrainDefinition(
                id=TerrainType.WATER.value,
                name="Water",
                color="#3498db",  # Modern bright blue
                move_cost=999.0,  # Effectively blocked for tanks
                blocked=True,
                detect_mult=1.0,
                los_blocks=False,
                description="Water - blocks tank movement, drones can fly over"
            ),
            TerrainType.ROAD.value: TerrainDefinition(
                id=TerrainType.ROAD.value,
                name="Road",
                color="#34495e",  # Modern dark gray
                move_cost=0.7,
                blocked=False,
                detect_mult=1.1,
                los_blocks=False,
                description="Road - faster movement, slightly better detection"
            ),
            TerrainType.BRIDGE.value: TerrainDefinition(
                id=TerrainType.BRIDGE.value,
                name="Bridge",
                color="#A9A9A9",  # Light gray, different from roads
                move_cost=0.9,
                blocked=False,
                detect_mult=1.0,
                los_blocks=False,
                description="Bridge - allows passage over water"
            )
        }
    
    def _init_grid(self):
        """Initialize grid with open terrain"""
        self.grid = []
        for y in range(self.grid_height):
            row = []
            for x in range(self.grid_width):
                row.append(TerrainType.OPEN.value)
            self.grid.append(row)
    
    def reset_to_default(self):
        """Reset terrain to default (all open terrain)"""
        self._init_default_terrain_types()
        self._init_grid()
    
    def world_to_grid(self, world_x: float, world_y: float) -> Tuple[int, int]:
        """Convert world coordinates to grid coordinates"""
        grid_x = int(world_x // self.cell_size)
        grid_y = int(world_y // self.cell_size)
        
        # Clamp to grid bounds
        grid_x = max(0, min(self.grid_width - 1, grid_x))
        grid_y = max(0, min(self.grid_height - 1, grid_y))
        
        return grid_x, grid_y
    
    def grid_to_world(self, grid_x: int, grid_y: int) -> Tuple[float, float]:
        """Convert grid coordinates to world coordinates (cell center)"""
        world_x = (grid_x + 0.5) * self.cell_size
        world_y = (grid_y + 0.5) * self.cell_size
        return world_x, world_y
    
    def get_terrain_at(self, world_x: float, world_y: float) -> TerrainDefinition:
        """Get terrain definition at world coordinates"""
        grid_x, grid_y = self.world_to_grid(world_x, world_y)
        terrain_id = self.grid[grid_y][grid_x]
        return self.terrain_defs.get(terrain_id, self.terrain_defs[TerrainType.OPEN.value])
    
    def set_terrain_at(self, world_x: float, world_y: float, terrain_type: str):
        """Set terrain type at world coordinates"""
        if terrain_type not in self.terrain_defs:
            return False
            
        grid_x, grid_y = self.world_to_grid(world_x, world_y)
        self.grid[grid_y][grid_x] = terrain_type
        return True
    
    def set_terrain_rect(self, x1: float, y1: float, x2: float, y2: float, terrain_type: str):
        """Set terrain type for a rectangular area"""
        if terrain_type not in self.terrain_defs:
            return False
        
        # Convert to grid coordinates
        gx1, gy1 = self.world_to_grid(min(x1, x2), min(y1, y2))
        gx2, gy2 = self.world_to_grid(max(x1, x2), max(y1, y2))
        
        # Fill rectangle
        for gy in range(gy1, gy2 + 1):
            for gx in range(gx1, gx2 + 1):
                if 0 <= gx < self.grid_width and 0 <= gy < self.grid_height:
                    self.grid[gy][gx] = terrain_type
        
        return True
    
    def get_movement_cost(self, world_x: float, world_y: float, entity_type: str = "tank") -> float:
        """Get movement cost at world coordinates for entity type"""
        terrain = self.get_terrain_at(world_x, world_y)
        
        # Drones can fly over water and other obstacles
        if entity_type == "drone":
            # Drones ignore most terrain effects except forests (tree height)
            if terrain.id == TerrainType.FOREST.value:
                return 1.2  # Slightly slower through trees
            return 1.0
        
        # Tanks are affected by all terrain
        return terrain.move_cost
    
    def is_blocked(self, world_x: float, world_y: float, entity_type: str = "tank") -> bool:
        """Check if position is blocked for entity type"""
        terrain = self.get_terrain_at(world_x, world_y)
        
        # Drones can fly over everything
        if entity_type == "drone":
            return False
        
        # Tanks are blocked by water and extremely high move costs
        return terrain.blocked or terrain.move_cost > 10.0
    
    def get_detection_multiplier(self, world_x: float, world_y: float) -> float:
        """Get detection radius multiplier at world coordinates"""
        terrain = self.get_terrain_at(world_x, world_y)
        return terrain.detect_mult
    
    def check_line_of_sight(self, x1: float, y1: float, x2: float, y2: float) -> bool:
        """Check if line of sight is clear between two points"""
        # Simple implementation: check if any cell along the line blocks LoS
        distance = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
        
        if distance == 0:
            return True
        
        # Step along the line checking terrain
        steps = max(1, int(distance / (self.cell_size * 0.5)))
        
        for i in range(steps + 1):
            t = i / steps if steps > 0 else 0
            x = x1 + t * (x2 - x1)
            y = y1 + t * (y2 - y1)
            
            terrain = self.get_terrain_at(x, y)
            if terrain.los_blocks:
                return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert terrain grid to dictionary for serialization"""
        return {
            "width": self.width,
            "height": self.height,
            "cell_size": self.cell_size,
            "grid_width": self.grid_width,
            "grid_height": self.grid_height,
            "terrain_definitions": {
                tid: {
                    "id": tdef.id,
                    "name": tdef.name,
                    "color": tdef.color,
                    "move_cost": tdef.move_cost,
                    "blocked": tdef.blocked,
                    "detect_mult": tdef.detect_mult,
                    "los_blocks": tdef.los_blocks,
                    "description": tdef.description
                }
                for tid, tdef in self.terrain_defs.items()
            },
            "grid": self.grid
        }
    
    def from_dict(self, data: Dict[str, Any]) -> bool:
        """Load terrain grid from dictionary"""
        try:
            self.width = data["width"]
            self.height = data["height"]
            self.cell_size = data["cell_size"]
            self.grid_width = data["grid_width"]
            self.grid_height = data["grid_height"]
            
            # Load terrain definitions
            self.terrain_defs = {}
            for tid, tdef_data in data["terrain_definitions"].items():
                self.terrain_defs[tid] = TerrainDefinition(**tdef_data)
            
            # Load grid
            self.grid = data["grid"]
            
            return True
            
        except Exception as e:
            print(f"Error loading terrain data: {e}")
            return False
    
    def save_to_file(self, filename: str) -> bool:
        """Save terrain to JSON file"""
        try:
            with open(filename, 'w') as f:
                json.dump(self.to_dict(), f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving terrain: {e}")
            return False
    
    def load_from_file(self, filename: str) -> bool:
        """Load terrain from JSON file"""
        try:
            with open(filename, 'r') as f:
                data = json.load(f)
            return self.from_dict(data)
        except Exception as e:
            print(f"Error loading terrain: {e}")
            return False
    
    def get_terrain_stats(self) -> Dict[str, int]:
        """Get statistics about terrain coverage"""
        stats = {}
        for terrain_id in self.terrain_defs.keys():
            stats[terrain_id] = 0
        
        for row in self.grid:
            for cell in row:
                if cell in stats:
                    stats[cell] += 1
        
        return stats
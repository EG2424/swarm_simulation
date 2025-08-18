# 3D Terrain Implementation

This document describes the 3D terrain visualization system added to the LLM Swarm simulation.

## Overview

The 3D terrain system adds WebGL-based 3D rendering capabilities while maintaining full compatibility with the existing 2D visualization. Users can seamlessly switch between 2D and 3D modes with a toggle button.

## Features

### ✅ Implemented Features

1. **3D Scene Rendering**
   - WebGL-based rendering using Three.js
   - Heightmap-based terrain mesh generation
   - Proper lighting with ambient and directional lights
   - Shadow mapping support

2. **Camera Controls**
   - **Orbit Mode (Default)**: Mouse-driven orbit/pan/tilt/zoom
   - **Fly Mode**: FPS-style camera with WASD movement
   - **Keyboard Controls**: WASD movement, Q/E altitude, R reset, F fly toggle
   - **Mouse Controls**: LMB orbit, RMB pan, wheel zoom
   - **Focus Control**: Click-to-focus terrain points for smooth camera movement

3. **Entity Rendering**
   - 3D billboards for drones and tanks that always face the camera
   - Terrain-aligned positioning (entities sit on terrain surface)
   - Real-time color updates based on entity state
   - Selection highlighting with golden rings
   - Proper scaling based on entity size slider

4. **Terrain System**
   - Heightmap-based terrain loading (PNG images)
   - Procedural fallback terrain generation
   - Configurable vertical exaggeration
   - Height-based gradient texturing
   - Bilinear interpolation for smooth elevation queries

5. **Interactive Features**
   - 3D raycasting for entity selection
   - Terrain click-to-move commands
   - Multi-entity selection (Shift+click)
   - Patrol route visualization (terrain-conforming lines)
   - Detection range visualization (terrain-conforming circles)

6. **Mode Switching**
   - Seamless 2D ↔ 3D mode switching
   - State preservation between modes
   - Camera position and settings persistence
   - UI control adaptation (zoom becomes camera distance in 3D)

7. **Performance Optimizations**
   - Frustum culling enabled
   - Geometry caching for entity meshes
   - Efficient terrain mesh generation with LOD support
   - Optimized update cycles

8. **User Interface**
   - Mode toggle buttons (2D/3D) in canvas controls
   - Help overlay with complete control reference (H key)
   - Dynamic UI labels (zoom → camera distance in 3D)
   - Help button (?) visible only in 3D mode

## File Structure

```
static/js/
├── renderer-3d.js          # Main 3D renderer class
├── terrain-provider.js     # Heightmap loading and terrain mesh generation
├── camera-controller-3d.js # 3D camera controls (orbit/pan/fly modes)
├── mode-manager.js         # 2D/3D mode switching and state management
└── help-overlay.js         # 3D controls help system

static/assets/terrain/
├── generate-sample.html    # Heightmap generator tool
└── sample_heightmap.png    # Generated sample terrain (created on first run)
```

## Usage

### Basic Controls

1. **Switch to 3D**: Click the "3D" button in the canvas controls
2. **Camera Movement**:
   - **Left Mouse**: Drag to orbit around the target
   - **Right Mouse**: Drag to pan the camera
   - **Mouse Wheel**: Zoom in/out
   - **WASD**: Move camera target
   - **Q/E**: Raise/lower camera target
   - **R**: Reset camera to default position
   - **F**: Toggle fly mode (FPS-style)
   - **H**: Show/hide help overlay

3. **Entity Interaction**:
   - **Left Click**: Select entity
   - **Shift+Click**: Multi-select entities
   - **Right Click on terrain**: Move selected entities to location
   - **Ctrl+Right Click**: Append waypoint to patrol route

### Configuration

The 3D system can be configured via the terrain provider settings:

```javascript
{
  terrain: {
    provider: "heightmap",
    src: "static/assets/terrain/sample_heightmap.png",
    cell_size: 20,
    base_height: 0,
    vertical_exaggeration: 1.2,
    lod: "auto"
  },
  camera: {
    mode: "orbit",
    minDistance: 10,
    maxDistance: 3000,
    minPolarAngle: 0.05,
    maxPolarAngle: 1.45,
    minAltitude: 3
  }
}
```

## Technical Details

### Coordinate System

- **2D World Coordinates**: (x, y) where y is the 2D north-south axis
- **3D World Coordinates**: (x, y, z) where y is elevation and z is the 3D north-south axis
- **Conversion**: 2D(x,y) → 3D(x, elevationAt(x,y), y)

### Terrain Provider Interface

```javascript
class TerrainProvider {
  getBounds(): {minX, minZ, maxX, maxZ}  // World bounds
  elevationAt(x, z): number              // Height at world coordinates
  buildMesh(opts): Promise<THREE.Mesh>   // Generate terrain mesh
}
```

### Performance Considerations

- **Entity Count**: Optimized for 100+ entities with billboards
- **Terrain Resolution**: Adaptive LOD based on quality settings
- **Update Frequency**: 60 FPS target with graceful degradation
- **Memory**: Geometry caching reduces memory allocation

## Browser Support

- **WebGL Required**: Falls back to 2D mode if WebGL unavailable
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: Limited support (performance dependent)

## Troubleshooting

### Common Issues

1. **3D Mode Disabled**: WebGL not supported or disabled
   - Solution: Enable WebGL in browser settings or update browser

2. **Poor Performance**: Low framerate in 3D mode
   - Solution: Lower entity count or terrain quality

3. **Terrain Not Loading**: Heightmap file not found
   - Solution: System automatically generates procedural terrain as fallback

4. **Controls Not Working**: Help overlay shows incorrect information
   - Solution: Press H to see current control scheme

### Debug Information

Check browser console for:
- WebGL support status
- Terrain loading messages
- Camera controller initialization
- Performance warnings

## Future Enhancements

### Planned Features (v2)

1. **Advanced Terrain**
   - Tiled terrain loading for large maps
   - Multiple texture layers
   - Collision detection refinements

2. **Enhanced Visuals**
   - Shadow mapping
   - Particle effects for explosions
   - Trail rendering for entity movement

3. **Performance**
   - Instanced rendering for large entity counts
   - Level-of-detail for distant entities
   - Occlusion culling

4. **Interaction**
   - Terrain editing tools
   - Waypoint visualization improvements
   - Multi-selection rectangles in 3D

## Integration Notes

The 3D system is designed to be:
- **Non-breaking**: All existing 2D functionality preserved
- **Optional**: Can be disabled via configuration
- **Compatible**: Works with existing WebSocket simulation data
- **Extensible**: Easy to add new 3D features

The implementation follows the original specification requirements and maintains the existing dark theme and Apple-like design aesthetic.
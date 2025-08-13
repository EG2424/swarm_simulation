# LLM Swarm Simulation

A comprehensive 2D drone-tank simulation with FastAPI backend, HTML5 Canvas frontend, and LLM integration for autonomous drone control.

## Features

### Core Simulation
- **Real-time 2D physics** with unicycle kinematics
- **Fixed timestep simulation** with configurable speed scaling
- **Entity system** supporting drones and tanks
- **Detection and engagement** mechanics
- **Kamikaze attack** system

### Entities

#### Drones (Delta Wing UAVs)
- **Visual States**: Green (idle/search), Yellow (tracking), Red (engaging), Grey (destroyed)
- **Control Modes**: 
  - Go To Position
  - Follow Tank
  - Follow Teammate
  - Random Search
  - Patrol Route
  - Hold Position
- **Manual Control**: WASD movement, Space to stop
- **Detection**: 40-unit radius, triggers tank color changes

#### Tanks (Armored Vehicles)
- **Visual States**: Red (undiscovered), Blue (detected by drone), Grey (destroyed)
- **Control Modes**:
  - Go To Position
  - Patrol Route
  - Hold Position
  - Flee to Cover
  - Hide and Ambush
- **Behaviors**: Automatic avoidance, flee when detected
- **Engagement**: Destroyed by kamikaze drone attacks

### Interface Features
- **Dark theme** with modern Apple-like design
- **Canvas rendering** with zoom and pan controls
- **Entity scaling** for large-area maps (down to 2-4px)
- **Multi-selection** with Shift+Click
- **Context menus** for quick actions
- **Real-time chat** and event logging
- **Performance metrics** and FPS monitoring

### Communication Layer
- **WebSocket** for real-time updates (swappable for ROS 2)
- **REST API** for configuration and control
- **Event broadcasting** for state synchronization
- **Message routing** with validation

### LLM Integration
- **OpenAI-compatible** API endpoints
- **Per-drone** conversation history
- **Context-aware** prompting with simulation state
- **Command parsing** from natural language
- **Streaming support** (planned)

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd llmswarm
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure LLM (optional):**
   Set environment variables:
   ```bash
   export OPENAI_API_KEY="your-api-key"
   export LLM_BASE_URL="https://api.openai.com/v1"  # or your endpoint
   ```

## Usage

### Starting the Simulation

1. **Start the server:**
   ```bash
   python main.py
   ```

2. **Open browser:**
   Navigate to `http://localhost:8000`

3. **Basic controls:**
   - Click **Start** to begin simulation
   - Use **Speed slider** to adjust simulation speed
   - **Zoom** and **Entity Size** sliders for viewport control

### Entity Control

#### Manual Control
1. **Select entity** by clicking on it
2. **Move with WASD** keys (single entity only)
3. **Space bar** to stop movement
4. **Right-click** for context menu

#### Mode Control
1. Select entity(s)
2. Use **control panel** on right sidebar
3. Choose mode from dropdown
4. Set parameters (coordinates, targets, routes)

#### Multi-Selection
1. **Shift+Click** to select multiple entities
2. Use **group commands** for batch operations
3. **Tab/Shift+Tab** to cycle through selection

### Scenarios

#### Loading Scenarios
1. Select scenario from dropdown in left sidebar
2. Click **Load** to reset and populate simulation
3. Built-in scenarios:
   - **Basic Patrol**: Simple search and patrol patterns
   - **Swarm vs Convoy**: Multiple drones vs moving tank formation

#### Creating Scenarios
Create JSON files in `scenarios/` directory:
```json
{
  "title": "My Scenario",
  "description": "Description here",
  "arena": {"width": 800, "height": 600},
  "entities": [
    {
      "type": "drone",
      "x": 100, "y": 100,
      "mode": "random_search"
    },
    {
      "type": "tank", 
      "x": 400, "y": 300,
      "mode": "patrol_route",
      "patrol_route": [
        {"x": 350, "y": 250},
        {"x": 450, "y": 350}
      ]
    }
  ]
}
```

### LLM Integration

#### Configuration
```bash
# Via API
curl -X POST http://localhost:8000/api/llm/configure \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your-key", "model": "gpt-4"}'
```

#### Using LLM Control
```bash
# Send command to drone
curl -X POST http://localhost:8000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "drone_id": "drone-uuid",
    "prompt": "Move to coordinates 400,300 and patrol the area",
    "context": {}
  }'
```

#### LLM Commands
The LLM can generate these JSON commands:
```json
{"mode": "go_to", "target_position": {"x": 400, "y": 300}}
{"mode": "follow_tank", "target_entity_id": "tank-uuid"}
{"mode": "patrol_route", "patrol_route": [{"x": 100, "y": 100}]}
```

## API Reference

### REST Endpoints

#### Simulation Control
- `GET /api/simulation/state` - Get current state
- `POST /api/simulation/control` - Control simulation
- `POST /api/entities/spawn` - Spawn new entity
- `POST /api/entities/{id}/command` - Command entity
- `DELETE /api/entities/{id}` - Remove entity

#### Scenarios
- `GET /api/scenarios` - List available scenarios
- `POST /api/scenarios/load` - Load scenario

#### LLM Integration
- `POST /api/llm/chat` - Send LLM request
- `POST /api/llm/configure` - Configure LLM settings
- `GET /api/llm/sessions` - Get active sessions
- `DELETE /api/llm/sessions/{drone_id}` - Clear session

### WebSocket Messages

#### Client to Server
```json
{"type": "get_state", "data": {}}
{"type": "spawn_entity", "data": {"type": "drone", "position": {"x": 100, "y": 100}}}
{"type": "command_entity", "data": {"entity_id": "uuid", "command": {...}}}
{"type": "select_entity", "data": {"entity_id": "uuid", "selected": true}}
```

#### Server to Client
```json
{"type": "simulation_update", "data": {...}}
{"type": "entity_spawned", "data": {...}}
{"type": "chat_message_added", "data": {...}}
```

## Architecture

### Backend Structure
```
├── main.py                 # FastAPI application
├── simulation/
│   ├── engine.py          # Core simulation engine
│   └── entities.py        # Drone and Tank classes
├── communication/
│   ├── schemas.py         # Pydantic models
│   └── message_router.py  # WebSocket message handling
├── llm/
│   └── integration.py     # LLM API integration
└── scenarios/             # JSON scenario files
```

### Frontend Structure
```
├── static/
│   ├── index.html         # Main interface
│   ├── styles.css         # Dark theme styles
│   └── js/
│       ├── app.js         # Main application
│       ├── websocket.js   # WebSocket communication
│       ├── renderer.js    # Canvas rendering
│       ├── ui-controls.js # Interface controls
│       ├── entity-controls.js # Entity management
│       └── chat.js        # Chat and events
```

## Development

### Key Design Principles
1. **Swappable Communication**: WebSocket layer designed for easy ROS 2 migration
2. **Offline Portability**: No external dependencies for core simulation
3. **Performance**: Viewport culling, LOD rendering, fixed timestep
4. **Scalability**: Supports very small entity scales for large maps
5. **Modularity**: Clear separation between simulation, communication, and UI

### Testing

Run the simulation and verify:
- Entity spawning and movement
- Detection mechanics (color changes)
- Kamikaze engagements
- Mode switching via UI
- Multi-selection and group commands
- WebSocket connectivity
- Scenario loading

### Extension Points

1. **New Entity Types**: Extend `Entity` base class
2. **Additional Behaviors**: Implement new modes in entity classes  
3. **Custom Renderers**: Create specialized rendering for new entity types
4. **ROS 2 Integration**: Replace WebSocket with ROS 2 publishers/subscribers
5. **Advanced LLM**: Multi-agent coordination, streaming responses

## Troubleshooting

### Common Issues

1. **WebSocket Connection Fails**
   - Check port 8000 availability
   - Verify firewall settings
   - Check browser console for errors

2. **Low FPS Performance**
   - Reduce entity count
   - Increase entity scale slider
   - Check browser hardware acceleration

3. **LLM Integration Not Working**
   - Verify API key configuration
   - Check network connectivity
   - Review server logs for errors

4. **Entity Selection Issues**
   - Ensure zoom level allows clicking
   - Try right-click context menu
   - Check entity scale visibility

### Log Files
- Server logs: Console output from `python main.py`
- Browser logs: Developer Tools → Console
- WebSocket messages: Network tab in Developer Tools

## Future Enhancements

### Planned Features
- **Terrain System**: Grid-based movement costs and cover
- **Advanced AI**: Behavior trees and FSM for entities
- **LLM Streaming**: Real-time response streaming
- **Group Chat**: Multi-drone LLM coordination
- **Performance**: WebGL rendering for large simulations
- **ROS 2 Bridge**: Full ROS 2 compatibility layer

### Contributing
1. Fork the repository
2. Create feature branch
3. Implement changes with tests
4. Submit pull request with detailed description

## License

MIT License - see LICENSE file for details.
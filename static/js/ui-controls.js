/**
 * UI Controls - Handles main interface controls and simulation management
 */

class UIControls {
    constructor() {
        this.simulationState = 'stopped';
        this.speedMultiplier = 1.0;
        this.zoom = 1.0;
        this.entityScale = 1.0;
        
        this.setupEventListeners();
        this.setupWebSocketHandlers();
    }

    setupEventListeners() {
        // Simulation controls
        document.getElementById('start-btn').addEventListener('click', () => {
            this.controlSimulation('start');
        });

        document.getElementById('pause-btn').addEventListener('click', () => {
            this.controlSimulation('pause');
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            if (confirm('Reset simulation? All entities will be removed.')) {
                this.controlSimulation('reset');
            }
        });

        // Speed control
        const speedSlider = document.getElementById('speed-slider');
        const speedDisplay = document.getElementById('speed-display');
        
        speedSlider.addEventListener('input', (e) => {
            this.speedMultiplier = parseFloat(e.target.value);
            speedDisplay.textContent = `${this.speedMultiplier.toFixed(1)}x`;
            this.controlSimulation('set_speed', this.speedMultiplier);
        });

        // Zoom control
        const zoomSlider = document.getElementById('zoom-slider');
        const zoomDisplay = document.getElementById('zoom-display');
        
        zoomSlider.addEventListener('input', (e) => {
            this.zoom = parseFloat(e.target.value);
            zoomDisplay.textContent = `${Math.round(this.zoom * 100)}%`;
            if (window.renderer) {
                window.renderer.setZoom(this.zoom);
            }
        });

        // Entity scale control
        const entityScaleSlider = document.getElementById('entity-scale-slider');
        const entityScaleDisplay = document.getElementById('entity-scale-display');
        
        entityScaleSlider.addEventListener('input', (e) => {
            this.entityScale = parseFloat(e.target.value);
            entityScaleDisplay.textContent = `${Math.round(this.entityScale * 100)}%`;
            if (window.renderer) {
                window.renderer.setEntityScale(this.entityScale);
            }
        });

        // Entity spawn controls
        document.getElementById('add-drone-btn').addEventListener('click', () => {
            this.spawnEntityAtRandomLocation('drone');
        });

        document.getElementById('add-tank-btn').addEventListener('click', () => {
            this.spawnEntityAtRandomLocation('tank');
        });

        // Scenario controls
        document.getElementById('load-scenario-btn').addEventListener('click', () => {
            const select = document.getElementById('scenario-select');
            if (select.value) {
                this.loadScenario(select.value);
            }
        });

        // Filter controls
        document.getElementById('filter-drones').addEventListener('change', () => {
            this.updateEntityList();
        });

        document.getElementById('filter-tanks').addEventListener('change', () => {
            this.updateEntityList();
        });

        document.getElementById('filter-destroyed').addEventListener('change', () => {
            this.updateEntityList();
        });

        // Tab controls
        document.getElementById('chat-tab').addEventListener('click', () => {
            this.showTab('chat');
        });

        document.getElementById('events-tab').addEventListener('click', () => {
            this.showTab('events');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyPress(e);
        });

        // Canvas context menu
        window.addEventListener('canvas-rightclick', (e) => {
            this.showContextMenu(e.detail.screenPos, e.detail.worldPos);
        });

        // Hide context menu on click elsewhere (but not on controls)
        document.addEventListener('click', (e) => {
            // Don't hide context menu if clicking on controls or selection info
            if (!e.target.closest('.context-menu') && 
                !e.target.closest('.selection-info') && 
                !e.target.closest('.control-panel')) {
                this.hideContextMenu();
            }
        });
    }

    setupWebSocketHandlers() {
        // Simulation state updates
        window.wsManager.on('simulation_state_changed', (data) => {
            this.updateSimulationState(data);
        });

        window.wsManager.on('simulation_update', (data) => {
            this.updateSimulationData(data);
        });

        // Entity events
        window.wsManager.on('entity_spawned', (data) => {
            console.log('Entity spawned:', data);
            this.updateEntityList();
        });

        window.wsManager.on('entity_removed', (data) => {
            console.log('Entity removed:', data);
            this.updateEntityList();
        });

        window.wsManager.on('entity_selection_changed', (data) => {
            this.handleEntitySelectionChanged(data);
        });

        // Connection events
        window.addEventListener('ws-connected', () => {
            this.onWebSocketConnected();
        });

        window.addEventListener('ws-disconnected', () => {
            this.onWebSocketDisconnected();
        });
    }

    controlSimulation(action, speedMultiplier = null) {
        if (window.wsManager.controlSimulation(action, speedMultiplier)) {
            // Update UI immediately for responsiveness
            if (action === 'start') {
                this.simulationState = 'running';
            } else if (action === 'pause') {
                this.simulationState = 'paused';
            } else if (action === 'reset') {
                this.simulationState = 'stopped';
            }
            this.updateSimulationStatusDisplay();
        }
    }

    spawnEntityAtRandomLocation(type, mode = null) {
        // Generate random position within arena bounds
        const x = 50 + Math.random() * 700;
        const y = 50 + Math.random() * 500;
        const heading = Math.random() * 2 * Math.PI;
        
        window.wsManager.spawnEntity(type, { x, y }, heading, mode);
    }

    loadScenario(scenarioName) {
        // TODO: Implement scenario loading
        console.log('Loading scenario:', scenarioName);
    }

    updateSimulationState(data) {
        if (data.simulation) {
            this.simulationState = data.simulation.state;
            this.speedMultiplier = data.simulation.speed_multiplier || 1.0;
            
            // Update UI elements
            document.getElementById('speed-slider').value = this.speedMultiplier;
            document.getElementById('speed-display').textContent = `${this.speedMultiplier.toFixed(1)}x`;
        }
        
        this.updateSimulationStatusDisplay();
        this.updateMetricsDisplay(data);
        this.updateEntityList(data.entities);
        
        // Update renderer
        if (window.renderer && data.entities) {
            window.renderer.updateEntities(data.entities, data.selected_entities);
        }
    }

    updateSimulationData(data) {
        this.updateSimulationState(data);
        
        // Update FPS counter
        if (data.simulation && data.simulation.fps) {
            document.getElementById('fps-counter').textContent = `FPS: ${data.simulation.fps}`;
        }
    }

    updateSimulationStatusDisplay() {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        statusIndicator.className = `status-indicator ${this.simulationState}`;
        statusText.textContent = this.simulationState.charAt(0).toUpperCase() + this.simulationState.slice(1);
        
        // Update control buttons
        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        
        if (this.simulationState === 'running') {
            startBtn.disabled = true;
            pauseBtn.disabled = false;
        } else {
            startBtn.disabled = false;
            pauseBtn.disabled = true;
        }
    }

    updateMetricsDisplay(data) {
        if (data.metrics) {
            const entityCounter = document.getElementById('entity-counter');
            entityCounter.textContent = `Entities: ${data.metrics.total_entities}`;
        }
    }

    updateEntityList(entities = []) {
        const entityList = document.getElementById('entity-list');
        const showDrones = document.getElementById('filter-drones').checked;
        const showTanks = document.getElementById('filter-tanks').checked;
        const showDestroyed = document.getElementById('filter-destroyed').checked;
        
        // Clear existing list
        entityList.innerHTML = '';
        
        // Filter and display entities
        const filteredEntities = entities.filter(entity => {
            if (entity.type === 'drone' && !showDrones) return false;
            if (entity.type === 'tank' && !showTanks) return false;
            if (entity.destroyed && !showDestroyed) return false;
            return true;
        });
        
        for (const entity of filteredEntities) {
            const item = document.createElement('div');
            item.className = `entity-item ${entity.selected ? 'selected' : ''}`;
            item.dataset.entityId = entity.id;
            
            item.innerHTML = `
                <div class="entity-info">
                    <div class="entity-status" style="background: ${entity.color}"></div>
                    <span>${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}</span>
                    <span class="entity-id">${entity.id.substring(0, 8)}</span>
                </div>
                <button class="remove-entity-btn" onclick="window.uiControls.removeEntity('${entity.id}')" title="Remove">×</button>
            `;
            
            // Add click handler for selection
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('remove-entity-btn')) {
                    window.wsManager.selectEntity(entity.id, !entity.selected, e.shiftKey);
                }
            });
            
            entityList.appendChild(item);
        }
    }

    removeEntity(entityId) {
        if (confirm('Remove this entity?')) {
            window.wsManager.removeEntity(entityId);
        }
    }

    handleEntitySelectionChanged(data) {
        // Update entity list selection display
        this.updateEntityListSelection();
        
        // Update entity control panel
        if (window.entityControls) {
            window.entityControls.updateControlPanel();
        }
    }

    updateEntityListSelection() {
        const entityItems = document.querySelectorAll('.entity-item');
        entityItems.forEach(item => {
            const entityId = item.dataset.entityId;
            const entity = this.findEntityById(entityId);
            
            if (entity && entity.selected) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    findEntityById(entityId) {
        if (window.renderer && window.renderer.entities) {
            return window.renderer.entities.find(e => e.id === entityId);
        }
        return null;
    }

    showTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Show/hide panels
        document.getElementById('chat-panel').classList.toggle('hidden', tabName !== 'chat');
        document.getElementById('events-panel').classList.toggle('hidden', tabName !== 'events');
    }

    showContextMenu(screenPos, worldPos) {
        const contextMenu = document.getElementById('context-menu');
        
        // Position the context menu at the exact mouse position
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${screenPos.x}px`;
        contextMenu.style.top = `${screenPos.y}px`;
        contextMenu.style.zIndex = '10000';
        
        contextMenu.classList.remove('hidden');
        
        // Adjust position if menu would go off-screen
        const rect = contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust horizontal position if menu goes off right edge
        if (screenPos.x + rect.width > viewportWidth) {
            contextMenu.style.left = `${viewportWidth - rect.width - 5}px`;
        }
        
        // Adjust vertical position if menu goes off bottom edge
        if (screenPos.y + rect.height > viewportHeight) {
            contextMenu.style.top = `${viewportHeight - rect.height - 5}px`;
        }
        
        // Store world position for context actions
        contextMenu.dataset.worldX = worldPos.x;
        contextMenu.dataset.worldY = worldPos.y;
        
        // Add context item handlers
        const contextItems = contextMenu.querySelectorAll('.context-item');
        contextItems.forEach(item => {
            item.onclick = () => {
                this.handleContextAction(item.dataset.action, worldPos);
                this.hideContextMenu();
            };
        });
    }

    hideContextMenu() {
        document.getElementById('context-menu').classList.add('hidden');
    }

    handleContextAction(action, worldPos) {
        switch (action) {
            case 'move-here':
                // Move selected entities to this position
                this.moveSelectedEntitiesTo(worldPos);
                break;
            case 'patrol-here':
                // Set patrol route for selected entities
                this.setPatrolRouteForSelected(worldPos);
                break;
            case 'remove':
                // Remove entities at this position
                this.removeEntitiesAt(worldPos);
                break;
        }
    }

    moveSelectedEntitiesTo(worldPos) {
        const selectedEntities = window.renderer?.entities?.filter(e => e.selected) || [];
        
        for (const entity of selectedEntities) {
            const command = {
                mode: entity.type === 'drone' ? 'go_to' : 'go_to',
                target_position: worldPos
            };
            
            window.wsManager.commandEntity(entity.id, command);
        }
    }

    setPatrolRouteForSelected(worldPos) {
        // TODO: Implement patrol route setting
        console.log('Set patrol route to', worldPos);
    }

    removeEntitiesAt(worldPos) {
        // TODO: Implement entity removal at position
        console.log('Remove entities at', worldPos);
    }

    handleKeyPress(e) {
        // Handle keyboard shortcuts
        if (e.target.tagName === 'INPUT') return; // Don't interfere with input fields
        
        switch (e.key) {
            case ' ': // Spacebar - start/pause
                e.preventDefault();
                if (this.simulationState === 'running') {
                    this.controlSimulation('pause');
                } else {
                    this.controlSimulation('start');
                }
                break;
            case 'r':
            case 'R':
                if (e.ctrlKey) {
                    e.preventDefault();
                    if (confirm('Reset simulation?')) {
                        this.controlSimulation('reset');
                    }
                }
                break;
            case 'Escape':
                // Clear selection
                if (window.renderer) {
                    for (const entityId of window.renderer.selectedEntityIds) {
                        window.wsManager.selectEntity(entityId, false);
                    }
                }
                break;
        }
    }

    onWebSocketConnected() {
        console.log('UI: WebSocket connected');
        // Request initial state
        window.wsManager.getState();
        
        // Update connection status
        document.body.classList.remove('disconnected');
    }

    onWebSocketDisconnected() {
        console.log('UI: WebSocket disconnected');
        
        // Update connection status
        document.body.classList.add('disconnected');
        
        // Show disconnection indicator
        this.simulationState = 'disconnected';
        this.updateSimulationStatusDisplay();
    }
}

// Global UI controls instance
window.uiControls = null;
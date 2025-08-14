/**
 * UI Controls - Handles main interface controls and simulation management
 */

class UIControls {
    constructor() {
        this.simulationState = 'stopped';
        this.speedMultiplier = 1.0;
        this.zoom = 1.0;
        this.entityScale = 1.0;
        this.pauseButtonDebounce = false;
        
        this.setupEventListeners();
        this.setupWebSocketHandlers();
    }

    setupEventListeners() {
        // Simulation controls
        document.getElementById('start-btn').addEventListener('click', () => {
            this.controlSimulation('start');
        });

        document.getElementById('pause-btn').addEventListener('click', () => {
            // Prevent multiple rapid clicks
            if (this.pauseButtonDebounce) return;
            this.pauseButtonDebounce = true;
            setTimeout(() => { this.pauseButtonDebounce = false; }, 500);
            
            console.log(`Pause button clicked, current state: ${this.simulationState}`);
            
            // Toggle between pause and start
            if (this.simulationState === 'running') {
                console.log('Sending pause command');
                this.controlSimulation('pause');
            } else if (this.simulationState === 'paused') {
                console.log('Sending start command');
                this.controlSimulation('start');
            }
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

        // Detection ranges toggle
        document.getElementById('show-detection-ranges').addEventListener('change', (e) => {
            if (window.renderer) {
                window.renderer.setShowDetectionRanges(e.target.checked);
            }
        });

        // Terrain toggle
        document.getElementById('show-terrain').addEventListener('change', (e) => {
            if (window.renderer) {
                window.renderer.setShowTerrain(e.target.checked);
            }
        });

        // Patrol routes toggle
        document.getElementById('show-patrol-routes').addEventListener('change', (e) => {
            if (window.renderer) {
                window.renderer.setShowPatrolRoutes(e.target.checked);
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
            this.updateEntityList(window.renderer?.entities || []);
        });

        document.getElementById('filter-tanks').addEventListener('change', () => {
            this.updateEntityList(window.renderer?.entities || []);
        });

        document.getElementById('filter-destroyed').addEventListener('change', () => {
            const entities = window.renderer?.entities || [];
            const destroyedCount = entities.filter(e => e.destroyed).length;
            console.log(`Destroyed filter toggled. Total entities: ${entities.length}, Destroyed: ${destroyedCount}`);
            console.log('Destroyed entities:', entities.filter(e => e.destroyed));
            this.updateEntityList(entities);
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

        window.wsManager.on('simulation_update', (data) => {
            // Sync UI state with server state
            if (data.state) {
                this.simulationState = data.state;
                this.updateSimulationStatusDisplay();
            }
        });

        window.wsManager.on('control_response', (data) => {
            // Update UI state based on server confirmation
            if (data.state) {
                this.simulationState = data.state;
                this.updateSimulationStatusDisplay();
                console.log(`Server confirmed state change to: ${data.state}`);
            }
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
        // Send command to server and wait for confirmation
        // Don't update UI state immediately - wait for server response
        window.wsManager.controlSimulation(action, speedMultiplier);
    }

    spawnEntityAtRandomLocation(type, mode = null) {
        // Generate safe random position for tanks, any position for drones
        let x, y;
        
        if (type === 'tank') {
            // For tanks, choose safe locations away from water and obstacles
            const safeAreas = [
                { minX: 50, maxX: 200, minY: 50, maxY: 150 },     // Top-left
                { minX: 600, maxX: 750, minY: 50, maxY: 150 },    // Top-right  
                { minX: 50, maxX: 200, minY: 400, maxY: 550 },    // Bottom-left
                { minX: 600, maxX: 750, minY: 400, maxY: 550 },   // Bottom-right
                { minX: 50, maxX: 750, minY: 350, maxY: 550 }     // Bottom strip
            ];
            
            const area = safeAreas[Math.floor(Math.random() * safeAreas.length)];
            x = area.minX + Math.random() * (area.maxX - area.minX);
            y = area.minY + Math.random() * (area.maxY - area.minY);
        } else {
            // Drones can spawn anywhere (they can fly)
            x = 50 + Math.random() * 700;
            y = 50 + Math.random() * 500;
        }
        
        const heading = Math.random() * 2 * Math.PI;
        
        window.wsManager.spawnEntity(type, { x, y }, heading, mode);
    }

    loadScenario(scenarioName) {
        if (!window.wsManager) {
            console.error('WebSocket manager not available');
            return;
        }
        
        if (!window.wsManager.isConnected) {
            console.error('WebSocket not connected');
            return;
        }
        
        const message = {
            type: 'load_scenario',
            data: {
                scenario_name: scenarioName
            }
        };
        
        window.wsManager.send(message);
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
        
        // Update terrain
        if (window.renderer && data.terrain) {
            window.renderer.updateTerrain(data.terrain);
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
            pauseBtn.textContent = 'Pause';
        } else if (this.simulationState === 'paused') {
            startBtn.disabled = false;
            pauseBtn.disabled = false;
            pauseBtn.textContent = 'Resume';
        } else {
            startBtn.disabled = false;
            pauseBtn.disabled = true;
            pauseBtn.textContent = 'Pause';
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
        
        console.log(`updateEntityList: entities=${entities.length}, showDrones=${showDrones}, showTanks=${showTanks}, showDestroyed=${showDestroyed}`);
        
        // Filter entities first
        const filteredEntities = entities.filter(entity => {
            // If showing destroyed, show all destroyed entities regardless of type
            if (showDestroyed && entity.destroyed) {
                return true;
            }
            
            // If not showing destroyed, filter out destroyed entities
            if (entity.destroyed && !showDestroyed) {
                return false;
            }
            
            // For non-destroyed entities, apply type filters
            if (entity.type === 'drone' && !showDrones) return false;
            if (entity.type === 'tank' && !showTanks) return false;
            
            return true;
        });
        
        console.log(`Filtered ${entities.length} entities down to ${filteredEntities.length}`);
        console.log('Filtered entities:', filteredEntities.map(e => `${e.type}-${e.id.substring(0,8)} (destroyed: ${e.destroyed})`));
        
        // Check if the list actually needs updating
        const currentItems = entityList.querySelectorAll('.entity-item');
        const currentIds = Array.from(currentItems).map(item => item.dataset.entityId).sort();
        const newIds = filteredEntities.map(entity => entity.id).sort();
        
        // Only rebuild if entity list changed
        if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
            // Clear and rebuild list
            entityList.innerHTML = '';
            
            for (const entity of filteredEntities) {
                const item = this.createEntityListItem(entity);
                entityList.appendChild(item);
            }
        } else {
            // Just update existing items
            for (const entity of filteredEntities) {
                const existingItem = entityList.querySelector(`[data-entity-id="${entity.id}"]`);
                if (existingItem) {
                    this.updateEntityListItem(existingItem, entity);
                }
            }
        }
    }
    
    createEntityListItem(entity) {
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
        
        // Add click handler for selection with debouncing
        let clickTimeout;
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-entity-btn')) return;
            
            // Prevent rapid clicks
            if (clickTimeout) return;
            
            clickTimeout = setTimeout(() => {
                window.wsManager.selectEntity(entity.id, !entity.selected, e.shiftKey);
                clickTimeout = null;
            }, 50);
        });
        
        // Prevent flickering on hover
        item.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
        });
        
        item.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
        });
        
        return item;
    }
    
    updateEntityListItem(item, entity) {
        // Update selection state without rebuilding
        item.className = `entity-item ${entity.selected ? 'selected' : ''}`;
        
        // Update status color
        const statusDiv = item.querySelector('.entity-status');
        if (statusDiv) {
            statusDiv.style.background = entity.color;
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
        const selectedEntities = window.renderer?.entities?.filter(e => e.selected) || [];
        
        for (const entity of selectedEntities) {
            // Add waypoint to existing patrol route
            const currentRoute = entity.patrol_route || [];
            const newRoute = [...currentRoute, worldPos];
            
            const command = {
                mode: 'patrol_route',
                patrol_route: newRoute
            };
            
            window.wsManager.commandEntity(entity.id, command);
        }
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
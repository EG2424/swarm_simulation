/**
 * Entity Controls - Handles entity selection and command interface
 */

class EntityControls {
    constructor() {
        this.selectedEntities = [];
        this.controlModes = {
            drone: ['go_to', 'follow_tank', 'follow_teammate', 'random_search', 'patrol_route', 'hold_position', 'kamikaze'],
            tank: ['go_to', 'patrol_route', 'hold_position', 'flee_to_cover', 'hide_and_ambush']
        };
        
        // Waypoint selection state
        this.waypointMode = false;
        this.waypointEntityId = null;
        
        this.setupEventListeners();
        this.setupCanvasListener();
    }

    setupCanvasListener() {
        // Listen for canvas clicks when in waypoint mode
        window.addEventListener('canvas-click', (e) => {
            if (this.waypointMode) {
                this.handleWaypointClick(e.detail.worldPos);
            }
        });
    }

    setupEventListeners() {
        // Selection info close button
        document.getElementById('deselect-btn').addEventListener('click', () => {
            this.clearSelection();
        });

        // WebSocket handlers for entity updates
        window.wsManager.on('entity_selection_changed', (data) => {
            this.updateSelectedEntities();
        });

        window.wsManager.on('simulation_update', (data) => {
            this.updateSelectedEntities();
            this.updateControlPanel();
        });

        // Manual control keys (WASD)
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            this.handleManualControl(e);
        });

        document.addEventListener('keyup', (e) => {
            if (e.target.tagName === 'INPUT') return;
            this.handleManualControlStop(e);
        });
    }

    updateSelectedEntities() {
        if (!window.renderer || !window.renderer.entities) return;
        
        const previouslySelected = this.selectedEntities.map(e => e.id);
        this.selectedEntities = window.renderer.entities.filter(entity => entity.selected);
        const currentlySelected = this.selectedEntities.map(e => e.id);
        
        // Only update UI if selection actually changed
        const selectionChanged = JSON.stringify(previouslySelected.sort()) !== JSON.stringify(currentlySelected.sort());
        
        if (this.selectedEntities.length > 0) {
            if (selectionChanged || document.getElementById('selection-info').classList.contains('hidden')) {
                this.showSelectionInfo();
            }
        } else {
            this.hideSelectionInfo();
        }
        
        if (selectionChanged) {
            this.updateControlPanel();
        }
    }

    showSelectionInfo() {
        const selectionInfo = document.getElementById('selection-info');
        selectionInfo.classList.remove('hidden');
        
        const title = document.getElementById('selection-title');
        if (this.selectedEntities.length === 1) {
            const entity = this.selectedEntities[0];
            title.textContent = `${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)} ${entity.id.substring(0, 8)}`;
        } else {
            title.textContent = `${this.selectedEntities.length} Entities Selected`;
        }
        
        this.updateSelectionDetails();
    }

    hideSelectionInfo() {
        document.getElementById('selection-info').classList.add('hidden');
    }

    updateSelectionDetails() {
        const statusDiv = document.getElementById('selection-status');
        const controlsDiv = document.getElementById('selection-controls');
        
        // Don't update if there's an active dropdown open
        const activeDropdown = controlsDiv.querySelector('select:focus');
        if (activeDropdown || this.dropdownActive) {
            return;
        }
        
        if (this.selectedEntities.length === 1) {
            const entity = this.selectedEntities[0];
            
            // Check if this is the same entity as before
            const currentEntityId = controlsDiv.dataset.currentEntity;
            const currentMode = controlsDiv.dataset.currentMode;
            if (currentEntityId === entity.id && currentMode === entity.mode) {
                // Only update status if both entity and mode are the same
                let statusHTML = `
                    <div class="status-item">
                        <strong>Status:</strong> ${entity.status || 'unknown'}
                    </div>
                    <div class="status-item">
                        <strong>Mode:</strong> ${entity.mode || 'none'}
                    </div>
                    <div class="status-item">
                        <strong>Position:</strong> (${Math.round(entity.position.x)}, ${Math.round(entity.position.y)})
                    </div>
                    <div class="status-item">
                        <strong>Health:</strong> ${Math.round(entity.health * 100)}%
                    </div>
                `;
                
                // Add kamikaze status for drones
                if (entity.type === 'drone') {
                    const kamikazeStatus = entity.kamikaze_enabled ? 'Enabled' : 'Disabled';
                    const kamikazeClass = entity.kamikaze_enabled ? 'text-danger' : 'text-muted';
                    statusHTML += `
                        <div class="status-item">
                            <strong>Kamikaze:</strong> <span class="${kamikazeClass}">${kamikazeStatus}</span>
                        </div>
                    `;
                }
                
                statusDiv.innerHTML = statusHTML;
                return;
            }
            
            // New entity selected or mode changed, rebuild controls
            controlsDiv.dataset.currentEntity = entity.id;
            controlsDiv.dataset.currentMode = entity.mode;
            
            // Show status
            let statusHTML = `
                <div class="status-item">
                    <strong>Status:</strong> ${entity.status || 'unknown'}
                </div>
                <div class="status-item">
                    <strong>Mode:</strong> ${entity.mode || 'none'}
                </div>
                <div class="status-item">
                    <strong>Position:</strong> (${Math.round(entity.position.x)}, ${Math.round(entity.position.y)})
                </div>
                <div class="status-item">
                    <strong>Health:</strong> ${Math.round(entity.health * 100)}%
                </div>
            `;
            
            // Add kamikaze status for drones
            if (entity.type === 'drone') {
                const kamikazeStatus = entity.kamikaze_enabled ? 'Enabled' : 'Disabled';
                const kamikazeClass = entity.kamikaze_enabled ? 'text-danger' : 'text-muted';
                statusHTML += `
                    <div class="status-item">
                        <strong>Kamikaze:</strong> <span class="${kamikazeClass}">${kamikazeStatus}</span>
                    </div>
                `;
            }
            
            statusDiv.innerHTML = statusHTML;
            
            // Show mode controls
            this.createModeControls(controlsDiv, entity);
            
        } else if (this.selectedEntities.length > 1) {
            controlsDiv.dataset.currentEntity = '';
            controlsDiv.dataset.currentMode = '';
            
            // Multi-selection summary
            const types = {};
            this.selectedEntities.forEach(entity => {
                types[entity.type] = (types[entity.type] || 0) + 1;
            });
            
            statusDiv.innerHTML = `
                <div class="multi-selection-summary">
                    ${Object.entries(types).map(([type, count]) => 
                        `<div>${count} ${type}${count > 1 ? 's' : ''}</div>`
                    ).join('')}
                </div>
            `;
            
            // Show common controls
            this.createMultiSelectionControls(controlsDiv);
        }
    }

    createModeControls(container, entity) {
        const modes = this.controlModes[entity.type] || [];
        
        container.innerHTML = `
            <div class="control-section">
                <div class="control-section-title">Mode</div>
                <select class="mode-select" id="entity-mode-select">
                    ${modes.map(mode => 
                        `<option value="${mode}" ${entity.mode === mode ? 'selected' : ''}>${this.formatModeName(mode)}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="control-section" id="mode-specific-controls">
                <!-- Mode-specific controls will be inserted here -->
            </div>
            
            <div class="control-section">
                <div class="control-section-title">Quick Actions</div>
                <button class="control-btn" onclick="window.entityControls.stopEntity('${entity.id}')">Stop</button>
                <button class="control-btn danger" onclick="window.entityControls.removeEntity('${entity.id}')">Remove</button>
            </div>
            
            ${entity.type === 'drone' ? `
            <div class="control-section">
                <div class="control-section-title">Kamikaze Control</div>
                <div class="toggle-container">
                    <label class="toggle-switch">
                        <input type="checkbox" id="kamikaze-toggle-${entity.id}" 
                               ${entity.kamikaze_enabled ? 'checked' : ''} 
                               onchange="window.entityControls.handleKamikazeToggle('${entity.id}', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                    <span class="toggle-label">${entity.kamikaze_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
            </div>
            ` : ''}
        `;
        
        // Add mode change handler with proper event handling
        const modeSelect = document.getElementById('entity-mode-select');
        if (modeSelect) {
            // Set a flag to prevent updates while dropdown is active
            modeSelect.addEventListener('mousedown', (e) => {
                this.dropdownActive = true;
                setTimeout(() => { this.dropdownActive = false; }, 1000);
            });
            
            modeSelect.addEventListener('change', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.changeEntityMode(entity.id, e.target.value);
                this.dropdownActive = false;
            });
            
            // Prevent dropdown from closing immediately
            modeSelect.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            modeSelect.addEventListener('focus', (e) => {
                e.stopPropagation();
                this.dropdownActive = true;
            });
            
            modeSelect.addEventListener('blur', (e) => {
                setTimeout(() => { this.dropdownActive = false; }, 100);
            });
        }
        
        // Create mode-specific controls
        this.createModeSpecificControls(entity);
    }

    createModeSpecificControls(entity) {
        const container = document.getElementById('mode-specific-controls');
        if (!container) {
            console.log(`[DEBUG] mode-specific-controls container not found!`);
            return;
        }
        
        const mode = entity.mode;
        console.log(`[DEBUG] Creating mode-specific controls for ${entity.type} in ${mode} mode`);
        let controlsHTML = '';
        
        switch (mode) {
            case 'go_to':
                controlsHTML = `
                    <div class="control-section-title">Target Position</div>
                    <div class="position-input">
                        <input type="number" id="target-x" placeholder="X" value="${entity.target_position?.x || ''}" style="width: 60px;">
                        <input type="number" id="target-y" placeholder="Y" value="${entity.target_position?.y || ''}" style="width: 60px;">
                        <button class="control-btn" onclick="window.entityControls.setTargetPosition('${entity.id}')">Set</button>
                    </div>
                    <div class="help-text">Click on map or enter coordinates</div>
                `;
                break;
                
            case 'follow_tank':
            case 'follow_teammate':
                const targetType = mode === 'follow_tank' ? 'tank' : 'drone';
                const availableTargets = this.getAvailableTargets(targetType, entity.id);
                
                controlsHTML = `
                    <div class="control-section-title">Target ${targetType.charAt(0).toUpperCase() + targetType.slice(1)}</div>
                    <select id="target-entity-select" class="mode-select">
                        <option value="">Select target...</option>
                        ${availableTargets.map(target => 
                            `<option value="${target.id}" ${entity.target_entity_id === target.id ? 'selected' : ''}>${target.id.substring(0, 8)}</option>`
                        ).join('')}
                    </select>
                    <button class="control-btn" onclick="window.entityControls.setTargetEntity('${entity.id}')">Set</button>
                `;
                break;
                
            case 'patrol_route':
                console.log(`[DEBUG] Creating patrol_route controls for ${entity.type}`, entity);
                controlsHTML = `
                    <div class="control-section-title">Waypoint Mode</div>
                    <div class="patrol-info">
                        ${entity.patrol_route?.length || 0} waypoints
                        ${entity.current_waypoint !== undefined ? `(current: ${entity.current_waypoint})` : ''}
                    </div>
                    <div class="patrol-controls">
                        <button class="control-btn" onclick="window.entityControls.addWaypoint('${entity.id}')">Add Waypoint</button>
                        <button class="control-btn" onclick="window.entityControls.clearRoute('${entity.id}')">Clear Route</button>
                    </div>
                    <div class="help-text">Click on map to add waypoints</div>
                `;
                break;
                
            default:
                // For all other modes (random_search, hold_position, kamikaze, etc.), show no controls
                console.log(`[DEBUG] Mode ${mode} has no specific controls - clearing`);
                controlsHTML = '';
                break;
        }
        
        console.log(`[DEBUG] Setting mode-specific controls HTML:`, controlsHTML);
        container.innerHTML = controlsHTML;
    }

    createMultiSelectionControls(container) {
        container.innerHTML = `
            <div class="control-section">
                <div class="control-section-title">Group Actions</div>
                <button class="control-btn" onclick="window.entityControls.stopAllSelected()">Stop All</button>
                <button class="control-btn" onclick="window.entityControls.formationMode()">Formation</button>
                <button class="control-btn danger" onclick="window.entityControls.removeAllSelected()">Remove All</button>
            </div>
        `;
    }

    updateControlPanel() {
        const controlPanel = document.getElementById('entity-control-panel');
        
        if (this.selectedEntities.length === 0) {
            controlPanel.innerHTML = '<div class="no-selection">Select an entity to control</div>';
            return;
        }
        
        // Create detailed control panel
        if (this.selectedEntities.length === 1) {
            this.createSingleEntityControlPanel(controlPanel);
        } else {
            this.createMultiEntityControlPanel(controlPanel);
        }
    }

    createSingleEntityControlPanel(container) {
        const entity = this.selectedEntities[0];
        
        container.innerHTML = `
            <div class="entity-header">
                <div class="entity-name">${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)} ${entity.id.substring(0, 8)}</div>
                <div class="entity-status-indicator" style="background: ${entity.color}"></div>
            </div>
            
            <div class="control-sections" id="control-sections">
                <!-- Control sections will be populated by updateControlPanel -->
            </div>
        `;
        
        this.populateControlSections(entity);
    }

    createMultiEntityControlPanel(container) {
        const entityTypes = {};
        this.selectedEntities.forEach(entity => {
            entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
        });
        
        container.innerHTML = `
            <div class="multi-entity-header">
                <div class="selection-count">${this.selectedEntities.length} entities selected</div>
                <div class="type-breakdown">
                    ${Object.entries(entityTypes).map(([type, count]) => 
                        `<span class="type-count">${count} ${type}${count > 1 ? 's' : ''}</span>`
                    ).join('')}
                </div>
            </div>
            
            <div class="multi-control-sections">
                <div class="control-section">
                    <div class="control-section-title">Group Commands</div>
                    <div class="button-group">
                        <button class="control-btn" onclick="window.entityControls.groupCommand('stop')">Stop All</button>
                        <button class="control-btn" onclick="window.entityControls.groupCommand('search')">Search Mode</button>
                        <button class="control-btn" onclick="window.entityControls.groupCommand('hold')">Hold Position</button>
                    </div>
                </div>
            </div>
        `;
    }

    populateControlSections(entity) {
        // This would be called after the main control panel is created
        // Implementation would depend on specific entity type and current mode
    }

    formatModeName(mode) {
        if (mode === 'patrol_route') {
            return 'Waypoint Mode';
        }
        return mode.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    getAvailableTargets(type, excludeId) {
        if (!window.renderer || !window.renderer.entities) return [];
        
        return window.renderer.entities.filter(entity => 
            entity.type === type && 
            entity.id !== excludeId && 
            !entity.destroyed
        );
    }

    // Command methods
    changeEntityMode(entityId, newMode) {
        console.log(`[DEBUG] Changing entity ${entityId} mode to ${newMode}`);
        const command = { mode: newMode };
        window.wsManager.commandEntity(entityId, command);
        
        // Update the entity's mode locally for immediate UI update
        const entity = this.selectedEntities.find(e => e.id === entityId);
        if (entity) {
            entity.mode = newMode;
            console.log(`[DEBUG] Updated entity mode locally to ${newMode}`);
        }
        
        // Force immediate control rebuild by clearing the cached mode
        const controlsDiv = document.getElementById('selection-controls');
        if (controlsDiv) {
            controlsDiv.dataset.currentMode = ''; // Clear cached mode to force rebuild
            console.log(`[DEBUG] Cleared cached mode, forcing rebuild`);
        }
        
        // Update the control panel immediately
        console.log(`[DEBUG] Updating control panel after mode change to ${newMode}`);
        this.updateSelectionDetails();
        
        // Also directly update the mode-specific controls
        setTimeout(() => {
            console.log(`[DEBUG] Direct mode-specific control update for ${newMode}`);
            const updatedEntity = this.selectedEntities.find(e => e.id === entityId);
            if (updatedEntity) {
                updatedEntity.mode = newMode; // Ensure mode is set
                this.createModeSpecificControls(updatedEntity);
            }
        }, 50);
    }

    setTargetPosition(entityId) {
        const targetX = parseFloat(document.getElementById('target-x').value);
        const targetY = parseFloat(document.getElementById('target-y').value);
        
        if (isNaN(targetX) || isNaN(targetY)) {
            alert('Please enter valid coordinates');
            return;
        }
        
        const command = {
            mode: 'go_to',
            target_position: { x: targetX, y: targetY }
        };
        
        window.wsManager.commandEntity(entityId, command);
    }

    setTargetEntity(entityId) {
        const targetId = document.getElementById('target-entity-select').value;
        if (!targetId) {
            alert('Please select a target entity');
            return;
        }
        
        const entity = this.selectedEntities.find(e => e.id === entityId);
        const mode = entity?.mode || 'follow_tank';
        
        const command = {
            mode: mode,
            target_entity_id: targetId
        };
        
        window.wsManager.commandEntity(entityId, command);
    }

    stopEntity(entityId) {
        const command = { mode: 'hold_position' };
        window.wsManager.commandEntity(entityId, command);
    }

    removeEntity(entityId) {
        if (confirm('Remove this entity?')) {
            window.wsManager.removeEntity(entityId);
        }
    }

    // Group commands
    groupCommand(action) {
        for (const entity of this.selectedEntities) {
            let command = {};
            
            switch (action) {
                case 'stop':
                    command = { mode: 'hold_position' };
                    break;
                case 'search':
                    command = { mode: entity.type === 'drone' ? 'random_search' : 'patrol_route' };
                    break;
                case 'hold':
                    command = { mode: 'hold_position' };
                    break;
            }
            
            window.wsManager.commandEntity(entity.id, command);
        }
    }

    stopAllSelected() {
        this.groupCommand('stop');
    }

    formationMode() {
        // TODO: Implement formation control
        console.log('Formation mode not yet implemented');
    }

    removeAllSelected() {
        if (confirm(`Remove ${this.selectedEntities.length} selected entities?`)) {
            for (const entity of this.selectedEntities) {
                window.wsManager.removeEntity(entity.id);
            }
        }
    }

    clearSelection() {
        for (const entity of this.selectedEntities) {
            window.wsManager.selectEntity(entity.id, false);
        }
    }

    // Manual control with WASD
    handleManualControl(e) {
        if (this.selectedEntities.length !== 1) return;
        
        const entity = this.selectedEntities[0];
        const speed = 5.0;
        let dx = 0, dy = 0;
        
        switch (e.key.toLowerCase()) {
            case 'w': dy = -speed; break;
            case 's': dy = speed; break;
            case 'a': dx = -speed; break;
            case 'd': dx = speed; break;
            case ' ': // Space to stop
                e.preventDefault();
                this.stopEntity(entity.id);
                return;
            default:
                return;
        }
        
        // Calculate target position
        const targetX = entity.position.x + dx * 10; // Move 10 units in direction
        const targetY = entity.position.y + dy * 10;
        
        const command = {
            mode: 'go_to',
            target_position: { x: targetX, y: targetY }
        };
        
        window.wsManager.commandEntity(entity.id, command);
    }

    handleManualControlStop(e) {
        // Could implement gradual stopping or continuous movement here
    }

    // Waypoint and route management
    addWaypoint(entityId) {
        // Enable waypoint selection mode
        this.waypointMode = true;
        this.waypointEntityId = entityId;
        
        // Show visual feedback
        const addBtn = document.querySelector(`button[onclick*="addWaypoint('${entityId}')"]`);
        if (addBtn) {
            addBtn.textContent = 'Click on map...';
            addBtn.disabled = true;
            addBtn.style.backgroundColor = '#FF9F0A';
        }
        
        // Add instruction overlay
        this.showWaypointInstructions(true);
        
        // Initialize with first waypoint message
        this.updateWaypointInstructions(0);
    }

    handleWaypointClick(worldPos) {
        if (!this.waypointMode || !this.waypointEntityId) return;
        
        // Get current entity
        const entity = window.renderer?.entities?.find(e => e.id === this.waypointEntityId);
        if (!entity) {
            this.cancelWaypointMode();
            return;
        }
        
        // Add waypoint to existing patrol route
        const currentRoute = entity.patrol_route || [];
        const newRoute = [...currentRoute, worldPos];
        
        // Send command to update patrol route
        const command = {
            mode: 'patrol_route',
            patrol_route: newRoute
        };
        
        window.wsManager.commandEntity(this.waypointEntityId, command);
        
        // Stay in waypoint mode for sequential adding
        // Just refresh the control panel to show updated waypoint count
        setTimeout(() => {
            this.updateControlPanel();
            this.updateWaypointButton();
        }, 100);
    }

    cancelWaypointMode() {
        this.waypointMode = false;
        
        // Reset button
        if (this.waypointEntityId) {
            const addBtn = document.querySelector(`button[onclick*="addWaypoint('${this.waypointEntityId}')"]`);
            if (addBtn) {
                addBtn.textContent = 'Add Waypoint';
                addBtn.disabled = false;
                addBtn.style.backgroundColor = '';
            }
        }
        
        this.waypointEntityId = null;
        this.showWaypointInstructions(false);
    }

    updateWaypointButton() {
        if (!this.waypointMode || !this.waypointEntityId) return;
        
        // Get current waypoint count
        const entity = window.renderer?.entities?.find(e => e.id === this.waypointEntityId);
        const waypointCount = entity?.patrol_route?.length || 0;
        
        // Update button text to show progress
        const addBtn = document.querySelector(`button[onclick*="addWaypoint('${this.waypointEntityId}')"]`);
        if (addBtn) {
            addBtn.textContent = `Added ${waypointCount} waypoint${waypointCount !== 1 ? 's' : ''} - Click for more...`;
        }
        
        // Update instruction text
        this.updateWaypointInstructions(waypointCount);
    }

    updateWaypointInstructions(waypointCount) {
        const instructionDiv = document.getElementById('waypoint-instructions');
        if (instructionDiv) {
            const content = instructionDiv.querySelector('.instruction-content span');
            if (content) {
                if (waypointCount === 0) {
                    content.textContent = 'Click on the map to add your first waypoint';
                } else if (waypointCount === 1) {
                    content.textContent = 'Click on the map to add another waypoint';
                } else {
                    content.textContent = `${waypointCount} waypoints added - Click to add more`;
                }
            }
        }
    }

    showWaypointInstructions(show) {
        let instructionDiv = document.getElementById('waypoint-instructions');
        
        if (show) {
            if (!instructionDiv) {
                instructionDiv = document.createElement('div');
                instructionDiv.id = 'waypoint-instructions';
                instructionDiv.className = 'waypoint-instructions';
                instructionDiv.innerHTML = `
                    <div class="instruction-content">
                        <span>Click on the map to add a waypoint</span>
                        <div class="instruction-buttons">
                            <button onclick="window.entityControls.cancelWaypointMode()" class="done-btn">Done</button>
                            <button onclick="window.entityControls.cancelWaypointMode()" class="cancel-btn">Cancel</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(instructionDiv);
            }
            instructionDiv.style.display = 'block';
        } else {
            if (instructionDiv) {
                instructionDiv.style.display = 'none';
            }
        }
    }

    clearRoute(entityId) {
        const command = {
            mode: 'patrol_route',
            patrol_route: []
        };
        
        window.wsManager.commandEntity(entityId, command);
    }

    // Kamikaze control methods
    handleKamikazeToggle(entityId, enabled) {
        // Prevent multiple rapid calls
        if (this.kamikazeToggleTimeout) {
            clearTimeout(this.kamikazeToggleTimeout);
        }
        
        this.kamikazeToggleTimeout = setTimeout(() => {
            // Send kamikaze toggle command to server
            window.wsManager.send({
                type: 'toggle_kamikaze',
                data: {
                    entity_id: entityId,
                    kamikaze_enabled: enabled
                }
            });
            
            // Update the toggle label immediately for better UX
            const toggleLabel = document.querySelector(`#kamikaze-toggle-${entityId}`).parentNode.parentNode.querySelector('.toggle-label');
            if (toggleLabel) {
                toggleLabel.textContent = enabled ? 'Enabled' : 'Disabled';
            }
            
            this.kamikazeToggleTimeout = null;
        }, 100);
    }
    
    toggleKamikaze(entityId, enabled) {
        // Legacy method - redirect to new handler
        this.handleKamikazeToggle(entityId, enabled);
    }
}

// Global entity controls instance
window.entityControls = null;
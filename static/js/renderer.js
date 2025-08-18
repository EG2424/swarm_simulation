/**
 * Canvas Renderer - 2D rendering for drones and tanks
 * Handles viewport, scaling, and entity visualization
 */

class CanvasRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Viewport settings
        this.viewport = {
            x: 0,
            y: 0,
            width: this.canvas.width,
            height: this.canvas.height,
            zoom: 1.0
        };
        
        // Rendering settings
        this.entityScale = 1.0;
        this.showDetectionRanges = false;
        this.showPatrolRoutes = true;  // Show patrol routes for waypoint system
        this.showSelectionOutlines = false;
        this.showTerrain = true;
        
        // Colors
        this.colors = {
            background: '#1a1a1a',
            grid: '#333333',
            text: '#ffffff',
            textSecondary: '#b0b0b0',
            selection: '#FFD700',
            detectionRange: '#FF9F0A40',
            patrolRoute: '#007AFF60',
            selectionBox: '#00AAFF80',
            selectionBoxBorder: '#00AAFF'
        };
        
        // Cached rendering data
        this.entities = [];
        this.selectedEntityIds = [];
        this.terrain = null;
        
        // AoE3-style selection state
        this.dragSelection = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0
        };
        
        // Double-click detection
        this.lastClickTime = 0;
        this.lastClickEntity = null;
        this.doubleClickThreshold = 300; // ms
        this.doubleClickRadius = 100; // pixels (reduced from 500)
        
        // Path preview
        this.pathPreview = {
            active: false,
            startPos: null,
            endPos: null,
            append: false
        };
        
        // AoE3-style terrain renderer
        this.terrainRenderer = new TerrainRenderer(this.ctx);
        
        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        // Set up high DPI rendering
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Update viewport
        this.viewport.width = rect.width;
        this.viewport.height = rect.height;
    }

    setupEventListeners() {
        // Handle canvas resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
        });
        
        // Handle mouse events for selection and interaction
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left mouse button
                this.handleMouseDown(e);
            }
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) { // Left mouse button
                this.handleMouseUp(e);
            }
        });
        
        this.canvas.addEventListener('click', (e) => {
            if (e.button === 0 && !this.dragSelection.active) {
                this.handleCanvasClick(e);
            }
        });
        
        this.canvas.addEventListener('dblclick', (e) => {
            this.handleDoubleClick(e);
        });
        
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleRightClick(e);
        });
        
        // Prevent text selection while dragging
        this.canvas.addEventListener('selectstart', (e) => {
            e.preventDefault();
        });
    }

    // World to screen coordinate conversion
    worldToScreen(worldX, worldY) {
        const screenX = (worldX - this.viewport.x) * this.viewport.zoom;
        const screenY = (worldY - this.viewport.y) * this.viewport.zoom;
        return { x: screenX, y: screenY };
    }

    // Screen to world coordinate conversion
    screenToWorld(screenX, screenY) {
        const worldX = (screenX / this.viewport.zoom) + this.viewport.x;
        const worldY = (screenY / this.viewport.zoom) + this.viewport.y;
        return { x: worldX, y: worldY };
    }

    setZoom(zoom) {
        zoom = Math.max(0.1, Math.min(5.0, zoom));
        this.viewport.zoom = zoom;
    }

    setEntityScale(scale) {
        this.entityScale = Math.max(0.1, Math.min(5.0, scale));
    }

    setShowDetectionRanges(show) {
        this.showDetectionRanges = show;
    }

    setShowTerrain(show) {
        this.showTerrain = show;
    }

    setShowPatrolRoutes(show) {
        this.showPatrolRoutes = show;
    }

    centerViewport(worldX, worldY) {
        this.viewport.x = worldX - this.viewport.width / (2 * this.viewport.zoom);
        this.viewport.y = worldY - this.viewport.height / (2 * this.viewport.zoom);
    }

    updateEntities(entities, selectedEntityIds = []) {
        this.entities = entities || [];
        this.selectedEntityIds = selectedEntityIds || [];
    }

    updateTerrain(terrain) {
        this.terrain = terrain;
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw terrain
        if (this.showTerrain && this.terrain) {
            this.drawTerrain();
        }
        
        // Draw entities
        for (const entity of this.entities) {
            this.drawEntity(entity);
        }
        
        // Draw overlays
        this.drawOverlays();
    }

    drawGrid() {
        const gridSize = 50 * this.viewport.zoom;
        const startX = (this.viewport.x % 50) * this.viewport.zoom;
        const startY = (this.viewport.y % 50) * this.viewport.zoom;
        
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 0.5;
        this.ctx.globalAlpha = 0.3;
        
        this.ctx.beginPath();
        
        // Vertical lines
        for (let x = -startX; x < this.viewport.width + gridSize; x += gridSize) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.viewport.height);
        }
        
        // Horizontal lines
        for (let y = -startY; y < this.viewport.height + gridSize; y += gridSize) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.viewport.width, y);
        }
        
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    drawEntity(entity) {
        const pos = this.worldToScreen(entity.position.x, entity.position.y);
        const scale = this.entityScale * this.viewport.zoom * (entity.scale || 1.0);
        const isSelected = this.selectedEntityIds.includes(entity.id);
        
        // Draw selection glow BEFORE entity transformation
        if (isSelected && !entity.destroyed) {
            this.drawSelectionGlow(entity, pos, scale);
        }
        
        this.ctx.save();
        this.ctx.translate(pos.x, pos.y);
        this.ctx.rotate(entity.heading);
        
        // Draw patrol route BEFORE entity transformation (only for selected entities) AND entity is in waypoint mode
        const isInWaypointMode = entity.mode === 'waypoint_mode' || entity.mode === 'patrol_route';
        if (isSelected && isInWaypointMode && entity.patrol_route && entity.patrol_route.length > 0) {
            // Temporarily restore context to draw unrotated route
            this.ctx.restore();
            this.drawPatrolRoute(entity);
            // Re-save and apply transformations for entity
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            this.ctx.rotate(entity.heading);
        }
        
        // Draw detection range (only for drones - they are the ones that detect)
        if (this.showDetectionRanges && !entity.destroyed && entity.type === 'drone') {
            this.drawDetectionRange(entity, scale);
        }
        
        // Draw entity shape
        if (entity.type === 'drone') {
            this.drawDrone(entity, scale, isSelected);
        } else if (entity.type === 'tank') {
            this.drawTank(entity, scale, isSelected);
        }
        
        this.ctx.restore();
        
        // Draw entity indicators (unrotated)
        if (isSelected || scale > 20) {
            this.drawEntityInfo(entity, pos);
        }
        
        // Draw special indicators
        if (!entity.destroyed) {
            this.drawEntityIndicators(entity, pos, scale, isSelected);
        }
    }

    drawDrone(entity, scale, isSelected) {
        const size = Math.max(4, scale * 8);
        const wingSpan = size * 1.5;
        const noseLength = size * 0.8;
        
        // Delta wing shape
        this.ctx.fillStyle = entity.color;
        this.ctx.strokeStyle = isSelected ? this.colors.selection : '#000000';
        this.ctx.lineWidth = isSelected ? 2 : 1;
        
        this.ctx.beginPath();
        // Nose
        this.ctx.moveTo(noseLength, 0);
        // Right wing
        this.ctx.lineTo(-size * 0.3, wingSpan / 2);
        // Tail
        this.ctx.lineTo(-size, size * 0.2);
        this.ctx.lineTo(-size, -size * 0.2);
        // Left wing
        this.ctx.lineTo(-size * 0.3, -wingSpan / 2);
        // Back to nose
        this.ctx.closePath();
        
        this.ctx.fill();
        if (this.showSelectionOutlines) {
            this.ctx.stroke();
        }
        
        // Draw center dot for very small scales
        if (size < 6) {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 1, 0, 2 * Math.PI);
            this.ctx.fill();
        }
        
        // Draw destroyed overlay
        if (entity.destroyed) {
            this.drawDestroyedOverlay(size);
        }
    }

    drawTank(entity, scale, isSelected) {
        const size = Math.max(4, scale * 6);
        
        // Square with beveled corners
        this.ctx.fillStyle = entity.color;
        this.ctx.strokeStyle = isSelected ? this.colors.selection : '#000000';
        this.ctx.lineWidth = isSelected ? 2 : 1;
        
        const cornerRadius = size * 0.15;
        const halfSize = size / 2;
        
        this.ctx.beginPath();
        this.drawRoundedRect(-halfSize, -halfSize, size, size, cornerRadius);
        this.ctx.fill();
        
        if (this.showSelectionOutlines) {
            this.ctx.stroke();
        }
        
        // Draw turret indicator
        if (size > 8) {
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, size * 0.2, 0, 2 * Math.PI);
            this.ctx.fill();
        }
        
        // Draw destroyed overlay
        if (entity.destroyed) {
            this.drawDestroyedOverlay(size);
        }
    }

    drawDestroyedOverlay(size) {
        // Draw X mark for destroyed entities
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(-size * 0.3, -size * 0.3);
        this.ctx.lineTo(size * 0.3, size * 0.3);
        this.ctx.moveTo(size * 0.3, -size * 0.3);
        this.ctx.lineTo(-size * 0.3, size * 0.3);
        this.ctx.stroke();
    }

    drawDetectionRange(entity, scale) {
        this.ctx.restore(); // Temporarily restore to draw unrotated circle
        
        const pos = this.worldToScreen(entity.position.x, entity.position.y);
        const radius = 40 * this.viewport.zoom; // Detection radius
        
        this.ctx.strokeStyle = this.colors.detectionRange;
        this.ctx.fillStyle = this.colors.detectionRange;
        this.ctx.lineWidth = 1;
        
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.save(); // Re-save for entity drawing
        this.ctx.translate(pos.x, pos.y);
        this.ctx.rotate(entity.heading);
    }

    drawPatrolRoute(entity) {
        if (!entity.patrol_route || entity.patrol_route.length < 1) return;
        
        // Save current context state
        this.ctx.save();
        
        // Reset transformations for drawing routes
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        const isSelected = this.selectedEntityIds.includes(entity.id);
        
        // Enhanced visibility for selected entities
        if (isSelected) {
            this.ctx.strokeStyle = '#FFD700';  // Gold color for selected
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.globalAlpha = 0.9;
        } else {
            this.ctx.strokeStyle = this.colors.patrolRoute;
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([3, 3]);
            this.ctx.globalAlpha = 0.7;
        }
        
        // Draw lines connecting waypoints (if more than one)
        if (entity.patrol_route.length > 1) {
            this.ctx.beginPath();
            
            for (let i = 0; i < entity.patrol_route.length; i++) {
                const waypoint = entity.patrol_route[i];
                const pos = this.worldToScreen(waypoint.x, waypoint.y);
                
                if (i === 0) {
                    this.ctx.moveTo(pos.x, pos.y);
                } else {
                    this.ctx.lineTo(pos.x, pos.y);
                }
            }
            
            // Close the loop if it's a patrol route with more than 2 waypoints
            if (entity.patrol_route.length > 2) {
                const firstPos = this.worldToScreen(entity.patrol_route[0].x, entity.patrol_route[0].y);
                this.ctx.lineTo(firstPos.x, firstPos.y);
            }
            
            this.ctx.stroke();
        }
        
        // Draw waypoint markers (larger for selected entities)
        this.ctx.setLineDash([]);
        for (let i = 0; i < entity.patrol_route.length; i++) {
            const waypoint = entity.patrol_route[i];
            const pos = this.worldToScreen(waypoint.x, waypoint.y);
            
            // Different styling for selected vs unselected
            if (isSelected) {
                // Outer circle (white)
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 5, 0, 2 * Math.PI);
                this.ctx.fill();
                
                // Inner circle (gold)
                this.ctx.fillStyle = '#FFD700';
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 3, 0, 2 * Math.PI);
                this.ctx.fill();
                
                // Add waypoint number
                this.ctx.fillStyle = '#000000';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText((i + 1).toString(), pos.x, pos.y + 3);
            } else {
                // Simple small circle
                this.ctx.fillStyle = this.colors.patrolRoute;
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 2, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        }
        
        // Restore context
        this.ctx.restore();
    }

    drawEntityInfo(entity, screenPos) {
        const infoOffset = 15;
        const fontSize = 10;
        
        this.ctx.font = `${fontSize}px -apple-system, sans-serif`;
        this.ctx.fillStyle = this.colors.text;
        this.ctx.textAlign = 'center';
        
        // Entity ID
        this.ctx.fillText(
            entity.id.substring(0, 8),
            screenPos.x,
            screenPos.y - infoOffset
        );
        
        // Status
        if (entity.mode || entity.status) {
            this.ctx.fillStyle = this.colors.textSecondary;
            this.ctx.fillText(
                entity.status || entity.mode,
                screenPos.x,
                screenPos.y + infoOffset + fontSize
            );
        }
    }
    
    drawSelectionGlow(entity, screenPos, scale) {
        const glowRadius = Math.max(15, scale * 10);
        
        // Create radial gradient for glow effect
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, glowRadius * 0.3,
            screenPos.x, screenPos.y, glowRadius
        );
        gradient.addColorStop(0, this.colors.selection + '40'); // 25% opacity
        gradient.addColorStop(0.7, this.colors.selection + '20'); // 12% opacity
        gradient.addColorStop(1, this.colors.selection + '00'); // 0% opacity
        
        this.ctx.save();
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, glowRadius, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Selection ring
        this.ctx.strokeStyle = this.colors.selection;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, glowRadius * 0.8, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawEntityIndicators(entity, screenPos, scale, isSelected) {
        const indicatorSize = Math.max(8, scale * 4);
        const offset = Math.max(20, scale * 12);
        
        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Kamikaze indicator for drones
        if (entity.type === 'drone' && entity.mode === 'kamikaze') {
            this.drawIndicator(screenPos.x - offset, screenPos.y - offset, 'K', '#FF0000', indicatorSize);
        }
        
        // Waypoint count indicator removed per user request
        
        // Following indicator
        if (entity.target_entity_id) {
            this.drawIndicator(screenPos.x, screenPos.y - offset, '→', '#00FF00', indicatorSize);
        }
        
        this.ctx.restore();
    }
    
    drawIndicator(x, y, text, color, size) {
        // Background circle
        this.ctx.fillStyle = color + 'CC'; // 80% opacity
        this.ctx.beginPath();
        this.ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Border
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        // Text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = `${size * 0.6}px bold sans-serif`;
        this.ctx.fillText(text, x, y);
    }

    drawRoundedRect(x, y, width, height, radius) {
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }

    drawOverlays() {
        // Draw additional UI overlays like minimap, HUD elements, etc.
        this.drawPerformanceMetrics();
        
        // Draw selection box if active
        if (this.dragSelection.active) {
            this.drawSelectionBox();
        }
        
        // Draw path preview if active
        if (this.pathPreview.active) {
            this.drawPathPreview();
        }
    }

    drawPerformanceMetrics() {
        // Draw FPS and entity count in corner
        const metrics = [
            `Entities: ${this.entities.length}`,
            `Selected: ${this.selectedEntityIds.length}`,
            `Zoom: ${Math.round(this.viewport.zoom * 100)}%`
        ];
        
        this.ctx.font = '11px monospace';
        this.ctx.fillStyle = this.colors.textSecondary;
        this.ctx.textAlign = 'left';
        
        for (let i = 0; i < metrics.length; i++) {
            this.ctx.fillText(
                metrics[i],
                10,
                20 + i * 14
            );
        }
    }

    // New AoE3-style mouse handling methods
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        // Check if clicking on an entity
        const clickedEntity = this.getEntityAtPosition(screenX, screenY);
        
        if (clickedEntity) {
            // Entity clicked - handle selection
            this.handleEntityClick(clickedEntity, e.shiftKey);
        } else {
            // Empty space clicked - start drag selection
            this.startDragSelection(screenX, screenY, e.shiftKey);
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        // Update drag selection if active
        if (this.dragSelection.active) {
            this.updateDragSelection(screenX, screenY);
        }
        
        // Handle cursor and hover effects
        this.handleCanvasMouseMove(screenX, screenY);
    }
    
    handleMouseUp(e) {
        if (this.dragSelection.active) {
            this.completeDragSelection(e.shiftKey);
        }
    }
    
    handleCanvasClick(e) {
        // This is called for single clicks that aren't part of drag selection
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        
        // Dispatch click event for waypoint system compatibility
        window.dispatchEvent(new CustomEvent('canvas-click', {
            detail: {
                worldPos,
                screenPos: { x: screenX, y: screenY },
                entity: null,
                shiftKey: e.shiftKey
            }
        }));
    }
    
    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        const clickedEntity = this.getEntityAtPosition(screenX, screenY);
        if (clickedEntity) {
            this.selectAllSameTypeUnits(clickedEntity);
        }
    }
    
    handleRightClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(canvasX, canvasY);
        
        const clickedEntity = this.getEntityAtPosition(canvasX, canvasY);
        
        if (clickedEntity) {
            // Right-clicked on entity - do nothing (could add entity-specific actions here)
            return;
        } else if (this.selectedEntityIds.length > 0) {
            // Right-clicked on ground with units selected - move command
            this.handleMoveCommand(worldPos, e.ctrlKey);
        } else {
            // Right-clicked with no selection - do nothing
            return;
        }
    }

    handleCanvasRightClick(canvasX, canvasY, absoluteX, absoluteY) {
        const worldPos = this.screenToWorld(canvasX, canvasY);
        
        // Show context menu at absolute screen position
        window.dispatchEvent(new CustomEvent('canvas-rightclick', {
            detail: {
                worldPos,
                screenPos: { x: absoluteX || canvasX, y: absoluteY || canvasY },
                canvasPos: { x: canvasX, y: canvasY }
            }
        }));
    }
    
    // AoE3-style selection helper methods
    getEntityAtPosition(screenX, screenY) {
        const worldPos = this.screenToWorld(screenX, screenY);
        const clickRadius = 15 / this.viewport.zoom; // Slightly larger for easier selection
        
        // Find the topmost entity at this position
        for (const entity of this.entities) {
            if (entity.destroyed) continue;
            
            const distance = Math.sqrt(
                Math.pow(entity.position.x - worldPos.x, 2) +
                Math.pow(entity.position.y - worldPos.y, 2)
            );
            
            if (distance <= clickRadius) {
                return entity;
            }
        }
        
        return null;
    }
    
    handleEntityClick(entity, shiftKey) {
        if (shiftKey) {
            // Shift+click: toggle selection
            const isSelected = this.selectedEntityIds.includes(entity.id);
            window.wsManager.selectEntity(entity.id, !isSelected, true);
        } else {
            // Normal click: select only this entity
            window.wsManager.selectEntity(entity.id, true, false);
        }
    }
    
    startDragSelection(screenX, screenY, shiftKey) {
        this.dragSelection.active = true;
        this.dragSelection.startX = screenX;
        this.dragSelection.startY = screenY;
        this.dragSelection.currentX = screenX;
        this.dragSelection.currentY = screenY;
        this.dragSelection.shiftKey = shiftKey;
    }
    
    updateDragSelection(screenX, screenY) {
        if (!this.dragSelection.active) return;
        
        this.dragSelection.currentX = screenX;
        this.dragSelection.currentY = screenY;
        this.dragSelection.lastUpdate = Date.now(); // Reset timeout
    }
    
    completeDragSelection(shiftKey) {
        if (!this.dragSelection.active) return;
        
        const startWorld = this.screenToWorld(this.dragSelection.startX, this.dragSelection.startY);
        const endWorld = this.screenToWorld(this.dragSelection.currentX, this.dragSelection.currentY);
        
        // Create selection rectangle
        const minX = Math.min(startWorld.x, endWorld.x);
        const maxX = Math.max(startWorld.x, endWorld.x);
        const minY = Math.min(startWorld.y, endWorld.y);
        const maxY = Math.max(startWorld.y, endWorld.y);
        
        // Find entities in selection box
        const entitiesInBox = this.entities.filter(entity => {
            if (entity.destroyed) return false;
            
            return entity.position.x >= minX && entity.position.x <= maxX &&
                   entity.position.y >= minY && entity.position.y <= maxY;
        });
        
        // Apply selection
        if (!shiftKey && !this.dragSelection.shiftKey) {
            // Clear existing selection first
            for (const entityId of this.selectedEntityIds) {
                window.wsManager.selectEntity(entityId, false, false);
            }
        }
        
        // Select entities in box
        for (const entity of entitiesInBox) {
            window.wsManager.selectEntity(entity.id, true, true);
        }
        
        // Reset drag selection
        this.dragSelection.active = false;
    }
    
    selectAllSameTypeUnits(clickedEntity) {
        const worldPos = { x: clickedEntity.position.x, y: clickedEntity.position.y };
        const sameTypeEntities = this.entities.filter(entity => {
            if (entity.destroyed || entity.type !== clickedEntity.type) return false;
            
            const distance = Math.sqrt(
                Math.pow(entity.position.x - worldPos.x, 2) +
                Math.pow(entity.position.y - worldPos.y, 2)
            );
            
            return distance <= this.doubleClickRadius;
        });
        
        // Clear existing selection
        for (const entityId of this.selectedEntityIds) {
            window.wsManager.selectEntity(entityId, false, false);
        }
        
        // Select all same-type entities
        for (const entity of sameTypeEntities) {
            window.wsManager.selectEntity(entity.id, true, true);
        }
    }
    
    handleMoveCommand(worldPos, isAppend) {
        // Send move commands to all selected entities
        for (const entityId of this.selectedEntityIds) {
            const entity = this.entities.find(e => e.id === entityId);
            if (!entity || entity.destroyed) continue;
            
            let command;
            
            if (isAppend && entity.patrol_route && entity.patrol_route.length > 0) {
                // Ctrl+Right Click: Append to existing route
                const newRoute = [...entity.patrol_route, worldPos];
                command = {
                    mode: 'waypoint_mode',
                    patrol_route: newRoute
                };
            } else {
                // Normal Right Click: Replace with single waypoint
                command = {
                    mode: 'waypoint_mode',
                    patrol_route: [worldPos]
                };
            }
            
            window.wsManager.commandEntity(entityId, command);
        }
    }
    
    drawSelectionBox() {
        if (!this.dragSelection.active) return;
        
        // Failsafe: If drag selection has been active for too long without mouse movement, clear it
        if (!this.dragSelection.lastUpdate) {
            this.dragSelection.lastUpdate = Date.now();
        } else if (Date.now() - this.dragSelection.lastUpdate > 5000) {
            console.warn('Clearing stuck drag selection');
            this.dragSelection.active = false;
            return;
        }
        
        const startX = this.dragSelection.startX;
        const startY = this.dragSelection.startY;
        const currentX = this.dragSelection.currentX;
        const currentY = this.dragSelection.currentY;
        
        const minX = Math.min(startX, currentX);
        const minY = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        
        // Only draw if the box is large enough
        if (width > 3 || height > 3) {
            this.ctx.save();
            
            // Draw selection box fill
            this.ctx.fillStyle = this.colors.selectionBox;
            this.ctx.fillRect(minX, minY, width, height);
            
            // Draw selection box border
            this.ctx.strokeStyle = this.colors.selectionBoxBorder;
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(minX, minY, width, height);
            
            this.ctx.restore();
        }
    }
    
    drawPathPreview() {
        if (!this.pathPreview.active || !this.pathPreview.startPos || !this.pathPreview.endPos) return;
        
        const startScreen = this.worldToScreen(this.pathPreview.startPos.x, this.pathPreview.startPos.y);
        const endScreen = this.worldToScreen(this.pathPreview.endPos.x, this.pathPreview.endPos.y);
        
        this.ctx.save();
        
        // Draw preview line
        this.ctx.strokeStyle = this.pathPreview.append ? '#FFAA00' : '#00AAFF';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 5]);
        this.ctx.globalAlpha = 0.8;
        
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x, startScreen.y);
        this.ctx.lineTo(endScreen.x, endScreen.y);
        this.ctx.stroke();
        
        // Draw arrow at end
        const angle = Math.atan2(endScreen.y - startScreen.y, endScreen.x - startScreen.x);
        const arrowLength = 10;
        
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.moveTo(endScreen.x, endScreen.y);
        this.ctx.lineTo(
            endScreen.x - arrowLength * Math.cos(angle - Math.PI / 6),
            endScreen.y - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(endScreen.x, endScreen.y);
        this.ctx.lineTo(
            endScreen.x - arrowLength * Math.cos(angle + Math.PI / 6),
            endScreen.y - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    handleCanvasMouseMove(screenX, screenY) {
        const worldPos = this.screenToWorld(screenX, screenY);
        
        // Find entity under cursor for tooltips
        let hoveredEntity = null;
        const hoverRadius = 15 / this.viewport.zoom;
        
        for (const entity of this.entities) {
            const distance = Math.sqrt(
                Math.pow(entity.position.x - worldPos.x, 2) +
                Math.pow(entity.position.y - worldPos.y, 2)
            );
            
            if (distance <= hoverRadius) {
                hoveredEntity = entity;
                break;
            }
        }
        
        // Update cursor
        this.canvas.style.cursor = hoveredEntity ? 'pointer' : 'crosshair';
    }

    drawTerrain() {
        if (!this.showTerrain || !this.terrain || !this.terrain.grid) {
            return;
        }

        // Use the new AoE3-style terrain renderer
        const cellSize = this.terrain.cell_size * this.viewport.zoom;
        const viewport = {
            x: this.viewport.x * this.viewport.zoom,
            y: this.viewport.y * this.viewport.zoom,
            width: this.viewport.width,
            height: this.viewport.height
        };
        
        this.terrainRenderer.renderTerrain(this.terrain, viewport, cellSize, this.showTerrain);
    }
    
    // Reset method for simulation resets
    reset() {
        console.log('Resetting 2D renderer...');
        
        try {
            // Clear entities
            this.entities = [];
            this.selectedEntityIds = [];
            
            // Reset camera/viewport to default
            this.viewport.x = 0;
            this.viewport.y = 0;
            this.viewport.zoom = 1.0;
            
            // Clear terrain
            this.terrain = null;
            
            // Clear any stuck selection states
            this.dragSelection.active = false;
            this.pathPreview.active = false;
            
            console.log('2D renderer reset complete');
        } catch (error) {
            console.error('Error during 2D renderer reset:', error);
        }
    }
}

// Global renderer instance
window.renderer = null;

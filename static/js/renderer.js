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
        this.showPatrolRoutes = false;  // Disabled to fix rendering bug
        this.showSelectionOutlines = true;
        this.showTerrain = true;
        
        // Colors
        this.colors = {
            background: '#1a1a1a',
            grid: '#333333',
            text: '#ffffff',
            textSecondary: '#b0b0b0',
            selection: '#FFD700',
            detectionRange: '#FF9F0A40',
            patrolRoute: '#007AFF60'
        };
        
        // Cached rendering data
        this.entities = [];
        this.selectedEntityIds = [];
        this.terrain = null;
        
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
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.handleCanvasClick(x, y, e.shiftKey);
        });
        
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            
            // Use absolute screen coordinates for context menu
            this.handleCanvasRightClick(canvasX, canvasY, e.clientX, e.clientY);
        });
        
        // Handle mouse move for tooltips
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.handleCanvasMouseMove(x, y);
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

    centerViewport(worldX, worldY) {
        this.viewport.x = worldX - this.viewport.width / (2 * this.viewport.zoom);
        this.viewport.y = worldY - this.viewport.height / (2 * this.viewport.zoom);
    }

    updateEntities(entities, selectedEntityIds = []) {
        this.entities = entities || [];
        this.selectedEntityIds = selectedEntityIds || [];
    }

    updateTerrain(terrain) {
        console.log('Updating terrain data:', terrain);
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
        
        this.ctx.save();
        this.ctx.translate(pos.x, pos.y);
        this.ctx.rotate(entity.heading);
        
        // Draw patrol route BEFORE entity transformation (if enabled and entity has route)
        if (this.showPatrolRoutes && entity.patrol_route && entity.patrol_route.length > 0) {
            // Temporarily restore context to draw unrotated route
            this.ctx.restore();
            this.drawPatrolRoute(entity);
            // Re-save and apply transformations for entity
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            this.ctx.rotate(entity.heading);
        }
        
        // Draw detection range (if enabled and entity is selected, or if showing all detection ranges for drones)
        if (this.showDetectionRanges && !entity.destroyed && (isSelected || entity.type === 'drone')) {
            this.drawDetectionRange(entity, scale);
        }
        
        // Draw entity shape
        if (entity.type === 'drone') {
            this.drawDrone(entity, scale, isSelected);
        } else if (entity.type === 'tank') {
            this.drawTank(entity, scale, isSelected);
        }
        
        this.ctx.restore();
        
        // Draw entity info (unrotated)
        if (isSelected || scale > 20) {
            this.drawEntityInfo(entity, pos);
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
        if (!entity.patrol_route || entity.patrol_route.length < 2) return;
        
        // Save current context state
        this.ctx.save();
        
        // Reset transformations for drawing routes
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        this.ctx.strokeStyle = this.colors.patrolRoute;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);
        this.ctx.globalAlpha = 0.7;
        
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
        
        // Close the loop if it's a patrol route
        if (entity.patrol_route.length > 2) {
            const firstPos = this.worldToScreen(entity.patrol_route[0].x, entity.patrol_route[0].y);
            this.ctx.lineTo(firstPos.x, firstPos.y);
        }
        
        this.ctx.stroke();
        
        // Draw waypoint markers
        this.ctx.fillStyle = this.colors.patrolRoute;
        this.ctx.setLineDash([]);
        for (const waypoint of entity.patrol_route) {
            const pos = this.worldToScreen(waypoint.x, waypoint.y);
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 2, 0, 2 * Math.PI);
            this.ctx.fill();
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

    handleCanvasClick(screenX, screenY, shiftKey = false) {
        const worldPos = this.screenToWorld(screenX, screenY);
        const clickRadius = 10 / this.viewport.zoom; // Adjust for zoom
        
        // Find clicked entity
        let clickedEntity = null;
        for (const entity of this.entities) {
            const distance = Math.sqrt(
                Math.pow(entity.position.x - worldPos.x, 2) +
                Math.pow(entity.position.y - worldPos.y, 2)
            );
            
            if (distance <= clickRadius) {
                clickedEntity = entity;
                break;
            }
        }
        
        if (clickedEntity) {
            // Select entity
            window.wsManager.selectEntity(clickedEntity.id, true, shiftKey);
        } else if (!shiftKey) {
            // Clear selection if not holding shift
            for (const entityId of this.selectedEntityIds) {
                window.wsManager.selectEntity(entityId, false);
            }
        }
        
        // Dispatch click event with world coordinates
        window.dispatchEvent(new CustomEvent('canvas-click', {
            detail: {
                worldPos,
                screenPos: { x: screenX, y: screenY },
                entity: clickedEntity,
                shiftKey
            }
        }));
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
        if (!this.terrain || !this.terrain.grid) {
            console.log('No terrain data to render:', this.terrain);
            return;
        }
        console.log('Drawing terrain with', this.terrain.grid_width, 'x', this.terrain.grid_height, 'cells');

        const terrain = this.terrain;
        const cellSize = terrain.cell_size * this.viewport.zoom;
        const startX = -this.viewport.x * this.viewport.zoom;
        const startY = -this.viewport.y * this.viewport.zoom;

        // Only render visible cells for performance
        const startGridX = Math.max(0, Math.floor(-startX / cellSize));
        const startGridY = Math.max(0, Math.floor(-startY / cellSize));
        const endGridX = Math.min(terrain.grid_width, Math.ceil((this.viewport.width - startX) / cellSize));
        const endGridY = Math.min(terrain.grid_height, Math.ceil((this.viewport.height - startY) / cellSize));

        // Draw terrain cells
        for (let gy = startGridY; gy < endGridY; gy++) {
            for (let gx = startGridX; gx < endGridX; gx++) {
                if (gy < terrain.grid.length && gx < terrain.grid[gy].length) {
                    const terrainType = terrain.grid[gy][gx];
                    const terrainDef = terrain.terrain_definitions[terrainType];
                    
                    if (terrainDef && terrainType !== 'open') { // Don't draw open terrain (default background)
                        const x = startX + gx * cellSize;
                        const y = startY + gy * cellSize;
                        
                        // Set terrain color
                        this.ctx.fillStyle = terrainDef.color;
                        this.ctx.fillRect(x, y, cellSize, cellSize);
                        
                        // Add simple patterns based on terrain type
                        if (this.viewport.zoom > 0.5) { // Only show patterns at higher zoom
                            this.drawTerrainPattern(x, y, cellSize, terrainType);
                        }
                    }
                }
            }
        }
    }

    drawTerrainPattern(x, y, size, terrainType) {
        this.ctx.save();
        
        switch (terrainType) {
            case 'forest':
                // Draw simple dots for trees
                this.ctx.fillStyle = '#1a3d1a';
                const dotSize = Math.max(2, size * 0.1);
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        const dotX = x + (i + 0.5) * (size / 3);
                        const dotY = y + (j + 0.5) * (size / 3);
                        this.ctx.beginPath();
                        this.ctx.arc(dotX, dotY, dotSize, 0, 2 * Math.PI);
                        this.ctx.fill();
                    }
                }
                break;
                
            case 'road':
                // Draw road stripes
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = Math.max(1, size * 0.05);
                this.ctx.beginPath();
                this.ctx.moveTo(x, y + size * 0.5);
                this.ctx.lineTo(x + size, y + size * 0.5);
                this.ctx.stroke();
                break;
                
            case 'water':
                // Draw wave pattern
                this.ctx.strokeStyle = '#4a7bc8';
                this.ctx.lineWidth = Math.max(1, size * 0.03);
                for (let i = 0; i < 3; i++) {
                    this.ctx.beginPath();
                    const waveY = y + (i + 1) * (size / 4);
                    this.ctx.moveTo(x, waveY);
                    this.ctx.quadraticCurveTo(x + size * 0.25, waveY - size * 0.1, x + size * 0.5, waveY);
                    this.ctx.quadraticCurveTo(x + size * 0.75, waveY + size * 0.1, x + size, waveY);
                    this.ctx.stroke();
                }
                break;
                
            case 'ruins':
                // Draw rubble pattern
                this.ctx.fillStyle = '#5a3626';
                for (let i = 0; i < 4; i++) {
                    const rubbleX = x + Math.random() * size;
                    const rubbleY = y + Math.random() * size;
                    const rubbleSize = Math.max(1, size * 0.08);
                    this.ctx.fillRect(rubbleX, rubbleY, rubbleSize, rubbleSize);
                }
                break;
                
            case 'minefield':
                // Draw hazard stripes
                this.ctx.strokeStyle = '#cc9900';
                this.ctx.lineWidth = Math.max(1, size * 0.03);
                for (let i = 0; i < 4; i++) {
                    this.ctx.beginPath();
                    const stripePos = i * (size / 4);
                    this.ctx.moveTo(x + stripePos, y);
                    this.ctx.lineTo(x + stripePos + size * 0.5, y + size);
                    this.ctx.stroke();
                }
                break;
        }
        
        this.ctx.restore();
    }
}

// Global renderer instance
window.renderer = null;
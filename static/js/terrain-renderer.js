/**
 * AoE3-Style Terrain Renderer
 * Handles procedural texture generation and continuous terrain appearance
 */

class TerrainRenderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.textureCache = new Map();
        this.overlayCache = new Map();
        this.transitionCache = new Map();
        
        // Texture settings
        this.tileSize = 64; // Visual tile size (covers multiple logical cells)
        this.overlayDensity = {
            forest: 0.2,
            ruins: 0.1,
            open: 0.05
        };
        
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;
        
        this.generateBaseTextures();
        this.generateTransitionTextures();
        this.generateOverlaySprites();
        
        this.initialized = true;
        console.log('AoE3 Terrain Renderer initialized');
    }

    generateBaseTextures() {
        console.log('Generating base terrain textures...');
        
        // Open terrain - grassy with dirt patches
        this.textureCache.set('open', this.createOpenTexture());
        
        // Forest - dark green base
        this.textureCache.set('forest', this.createForestTexture());
        
        // Water - blue gradient
        this.textureCache.set('water', this.createWaterTexture());
        
        // Road - brown dirt path
        this.textureCache.set('road', this.createRoadTexture());
        
        // Ruins - gray stone
        this.textureCache.set('ruins', this.createRuinsTexture());
        
        // Bridge - wooden planks
        this.textureCache.set('bridge', this.createBridgeTexture());
    }

    createOpenTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');

        // Modern suburban grass - more maintained look
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 45);
        gradient.addColorStop(0, '#6b8e5a'); // Healthier green center
        gradient.addColorStop(0.7, '#7a9f69'); // Bright suburban green
        gradient.addColorStop(1, '#5a7d49'); // Slightly darker edge
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.tileSize, this.tileSize);

        // Add some concrete/pavement patches (urban setting)
        ctx.fillStyle = '#9a9a9a';
        for (let i = 0; i < 3; i++) {
            const x = Math.random() * this.tileSize;
            const y = Math.random() * this.tileSize;
            const size = 2 + Math.random() * 6;
            
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Add some wear patterns (foot traffic, vehicle tracks)
        ctx.fillStyle = '#6a7a5a';
        for (let i = 0; i < 2; i++) {
            const x = Math.random() * this.tileSize;
            const y = Math.random() * this.tileSize;
            const width = 4 + Math.random() * 8;
            const height = 2 + Math.random() * 4;
            
            ctx.globalAlpha = 0.15;
            ctx.beginPath();
            ctx.ellipse(x, y, width/2, height/2, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Add subtle noise texture
        this.addNoiseTexture(ctx, 0.08);
        ctx.globalAlpha = 1;

        return canvas;
    }

    createForestTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');

        // Dark forest floor
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 45);
        gradient.addColorStop(0, '#2d4a2d');
        gradient.addColorStop(0.7, '#234023');
        gradient.addColorStop(1, '#1a331a');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.tileSize, this.tileSize);

        // Add darker patches
        ctx.fillStyle = '#1a2e1a';
        for (let i = 0; i < 8; i++) {
            const x = Math.random() * this.tileSize;
            const y = Math.random() * this.tileSize;
            const size = 4 + Math.random() * 12;
            
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        this.addNoiseTexture(ctx, 0.15);
        ctx.globalAlpha = 1;

        return canvas;
    }

    createWaterTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');

        // Water gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, this.tileSize);
        gradient.addColorStop(0, '#4a90e2');
        gradient.addColorStop(0.5, '#357abd');
        gradient.addColorStop(1, '#2e6ba8');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.tileSize, this.tileSize);

        // Add water ripple effect
        for (let i = 0; i < 3; i++) {
            const y = Math.random() * this.tileSize;
            ctx.strokeStyle = '#5ba3f5';
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            
            for (let x = 0; x < this.tileSize; x += 4) {
                ctx.lineTo(x, y + Math.sin(x * 0.1) * 2);
            }
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        return canvas;
    }

    createRoadTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');

        // Modern asphalt base - dark gray
        const gradient = ctx.createLinearGradient(0, 0, this.tileSize, 0);
        gradient.addColorStop(0, '#3a3a3a');
        gradient.addColorStop(0.5, '#2f2f2f');
        gradient.addColorStop(1, '#3a3a3a');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.tileSize, this.tileSize);

        // Add asphalt aggregate texture
        ctx.fillStyle = '#4a4a4a';
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * this.tileSize;
            const y = Math.random() * this.tileSize;
            const size = 0.5 + Math.random() * 1.5;
            
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Modern lane markings - yellow center line
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;
        ctx.setLineDash([this.tileSize * 0.15, this.tileSize * 0.1]);
        
        ctx.beginPath();
        ctx.moveTo(0, this.tileSize * 0.5);
        ctx.lineTo(this.tileSize, this.tileSize * 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        // Subtle tire marks
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.2;
        
        ctx.beginPath();
        ctx.moveTo(0, this.tileSize * 0.35);
        ctx.lineTo(this.tileSize, this.tileSize * 0.35);
        ctx.moveTo(0, this.tileSize * 0.65);
        ctx.lineTo(this.tileSize, this.tileSize * 0.65);
        ctx.stroke();

        this.addNoiseTexture(ctx, 0.08);
        ctx.globalAlpha = 1;

        return canvas;
    }

    createRuinsTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');

        // Modern concrete base
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 45);
        gradient.addColorStop(0, '#b0b0b0'); // Light concrete
        gradient.addColorStop(0.7, '#8a8a8a'); // Medium concrete
        gradient.addColorStop(1, '#606060'); // Dark concrete
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.tileSize, this.tileSize);

        // Add concrete block/panel patterns (modern buildings)
        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.6;
        
        // Large rectangular panels (modern architecture)
        for (let x = 0; x < this.tileSize; x += 12 + Math.random() * 16) {
            for (let y = 0; y < this.tileSize; y += 8 + Math.random() * 12) {
                const width = 8 + Math.random() * 12;
                const height = 6 + Math.random() * 10;
                ctx.beginPath();
                ctx.rect(x, y, width, height);
                ctx.stroke();
            }
        }

        // Add rebar/steel reinforcement showing through
        ctx.strokeStyle = '#8B4513'; // Rusty brown
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        
        for (let i = 0; i < 3; i++) {
            const x = Math.random() * this.tileSize;
            const y = Math.random() * this.tileSize;
            const length = 8 + Math.random() * 16;
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + length, y + Math.random() * 6 - 3);
            ctx.stroke();
        }

        // Add glass fragments
        ctx.fillStyle = '#87CEEB'; // Light blue glass
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * this.tileSize;
            const y = Math.random() * this.tileSize;
            const size = 1 + Math.random() * 3;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        this.addNoiseTexture(ctx, 0.15);
        ctx.globalAlpha = 1;

        return canvas;
    }

    createBridgeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');

        // Modern concrete bridge base
        const gradient = ctx.createLinearGradient(0, 0, 0, this.tileSize);
        gradient.addColorStop(0, '#c0c0c0'); // Light concrete
        gradient.addColorStop(0.5, '#a0a0a0'); // Medium concrete
        gradient.addColorStop(1, '#909090'); // Darker concrete
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.tileSize, this.tileSize);

        // Concrete expansion joints
        ctx.strokeStyle = '#606060';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.7;
        
        for (let y = 0; y < this.tileSize; y += this.tileSize / 3) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.tileSize, y);
            ctx.stroke();
        }

        // Steel reinforcement pattern
        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.4;
        
        // Horizontal reinforcement lines
        for (let y = 8; y < this.tileSize; y += 16) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.tileSize, y);
            ctx.stroke();
        }

        // Modern bridge bolts/fasteners
        ctx.fillStyle = '#333333';
        ctx.globalAlpha = 0.8;
        for (let x = 12; x < this.tileSize; x += 20) {
            for (let y = 12; y < this.tileSize; y += 20) {
                // Hexagonal bolts
                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                ctx.fill();
                
                // Bolt shadow
                ctx.fillStyle = '#1a1a1a';
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.arc(x + 0.5, y + 0.5, 1.5, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#333333';
                ctx.globalAlpha = 0.8;
            }
        }

        // Bridge surface texture (anti-slip pattern)
        ctx.strokeStyle = '#808080';
        ctx.lineWidth = 0.3;
        ctx.globalAlpha = 0.2;
        
        for (let x = 0; x < this.tileSize; x += 4) {
            for (let y = 0; y < this.tileSize; y += 4) {
                if ((x + y) % 8 === 0) {
                    ctx.beginPath();
                    ctx.rect(x, y, 2, 2);
                    ctx.stroke();
                }
            }
        }

        this.addNoiseTexture(ctx, 0.05);
        ctx.globalAlpha = 1;
        return canvas;
    }

    addNoiseTexture(ctx, intensity) {
        const imageData = ctx.getImageData(0, 0, this.tileSize, this.tileSize);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * intensity * 255;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    generateTransitionTextures() {
        console.log('Generating transition textures...');
        
        // 8-directional transitions for each terrain pair
        const terrainTypes = ['open', 'forest', 'water', 'road', 'ruins', 'bridge'];
        
        for (const fromTerrain of terrainTypes) {
            for (const toTerrain of terrainTypes) {
                if (fromTerrain !== toTerrain) {
                    this.createTransitionTexture(fromTerrain, toTerrain);
                }
            }
        }
    }

    createTransitionTexture(fromTerrain, toTerrain) {
        const key = `${fromTerrain}_to_${toTerrain}`;
        
        // For now, create simple gradient transitions
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');
        
        // Create horizontal blend as example
        const gradient = ctx.createLinearGradient(0, 0, this.tileSize, 0);
        
        // Get base colors (simplified)
        const fromColor = this.getTerrainBaseColor(fromTerrain);
        const toColor = this.getTerrainBaseColor(toTerrain);
        
        gradient.addColorStop(0, fromColor);
        gradient.addColorStop(0.3, fromColor);
        gradient.addColorStop(0.7, toColor);
        gradient.addColorStop(1, toColor);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.tileSize, this.tileSize);
        
        this.transitionCache.set(key, canvas);
    }

    getTerrainBaseColor(terrain) {
        const colors = {
            open: '#4a7c59',
            forest: '#2d4a2d',
            water: '#4a90e2',
            road: '#8b7355',
            ruins: '#909090',
            bridge: '#8b4513'
        };
        return colors[terrain] || '#4a7c59';
    }

    generateOverlaySprites() {
        console.log('Generating overlay sprites...');
        
        // Trees for forests
        this.overlayCache.set('tree_1', this.createTreeSprite(12, 16));
        this.overlayCache.set('tree_2', this.createTreeSprite(10, 14));
        this.overlayCache.set('tree_3', this.createTreeSprite(14, 18));
        
        // Rocks for open areas
        this.overlayCache.set('rock_1', this.createRockSprite(6, 4));
        this.overlayCache.set('rock_2', this.createRockSprite(8, 6));
        
        // Rubble for ruins
        this.overlayCache.set('rubble_1', this.createRubbleSprite(8, 6));
        this.overlayCache.set('rubble_2', this.createRubbleSprite(10, 8));
    }

    createTreeSprite(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Tree trunk
        ctx.fillStyle = '#4a3728';
        ctx.fillRect(width/2 - 1, height - 6, 2, 6);
        
        // Tree canopy
        ctx.fillStyle = '#2d5a2d';
        ctx.beginPath();
        ctx.arc(width/2, height/2, width/3, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = '#3d6b3d';
        ctx.beginPath();
        ctx.arc(width/2 - 1, height/2 - 1, width/4, 0, Math.PI * 2);
        ctx.fill();
        
        return canvas;
    }

    createRockSprite(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Rock base
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.ellipse(width/2, height/2, width/2, height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = '#a0a0a0';
        ctx.beginPath();
        ctx.ellipse(width/2 - 1, height/2 - 1, width/3, height/3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        return canvas;
    }

    createRubbleSprite(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Modern building debris - concrete chunks
        ctx.fillStyle = '#a0a0a0';
        for (let i = 0; i < 2; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const w = 2 + Math.random() * 4;
            const h = 2 + Math.random() * 3;
            
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.fill();
        }
        
        // Add some rebar pieces
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        for (let i = 0; i < 1; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const length = 3 + Math.random() * 4;
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + length, y + Math.random() * 2 - 1);
            ctx.stroke();
        }
        
        // Add glass fragments
        ctx.fillStyle = '#87CEEB';
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 2; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = 0.5 + Math.random() * 1.5;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        
        return canvas;
    }

    renderTerrain(terrain, viewport, cellSize, showTerrain) {
        if (!showTerrain || !terrain || !terrain.grid) return;
        
        this.initialize();
        
        // Calculate visible grid bounds
        const startGridX = Math.max(0, Math.floor(-viewport.x / cellSize));
        const startGridY = Math.max(0, Math.floor(-viewport.y / cellSize));
        const endGridX = Math.min(terrain.grid_width, Math.ceil((viewport.width - viewport.x) / cellSize));
        const endGridY = Math.min(terrain.grid_height, Math.ceil((viewport.height - viewport.y) / cellSize));
        
        // Render terrain tiles
        this.renderTerrainTiles(terrain, startGridX, startGridY, endGridX, endGridY, viewport, cellSize);
        
        // Render overlay objects
        this.renderOverlayObjects(terrain, startGridX, startGridY, endGridX, endGridY, viewport, cellSize);
    }

    renderTerrainTiles(terrain, startX, startY, endX, endY, viewport, cellSize) {
        const ctx = this.ctx;
        
        // First pass: render all base terrain tiles
        for (let gy = startY; gy < endY; gy++) {
            for (let gx = startX; gx < endX; gx++) {
                if (gy >= terrain.grid.length || gx >= terrain.grid[gy].length) continue;
                
                const terrainType = terrain.grid[gy][gx];
                const texture = this.textureCache.get(terrainType);
                
                if (!texture) continue;
                
                const screenX = gx * cellSize + viewport.x;
                const screenY = gy * cellSize + viewport.y;
                
                // Draw base texture (scaled to cellSize)
                ctx.drawImage(texture, screenX, screenY, cellSize, cellSize);
            }
        }
        
        // Second pass: render seamless transitions using region-based approach
        this.renderSeamlessTransitions(terrain, startX, startY, endX, endY, viewport, cellSize);
    }

    renderSeamlessTransitions(terrain, startX, startY, endX, endY, viewport, cellSize) {
        const ctx = this.ctx;
        
        // Use subtle alpha blending for natural transitions
        ctx.save();
        ctx.globalAlpha = 0.3;
        
        // Only render transitions between significantly different terrain types
        for (let gy = startY; gy < endY; gy++) {
            for (let gx = startX; gx < endX; gx++) {
                if (gy >= terrain.grid.length || gx >= terrain.grid[gy].length) continue;
                
                const currentTerrain = terrain.grid[gy][gx];
                const screenX = gx * cellSize + viewport.x;
                const screenY = gy * cellSize + viewport.y;
                
                // Check only direct neighbors (not diagonals) to avoid over-blending
                const neighbors = [
                    { dx: 0, dy: -1 }, // North
                    { dx: 1, dy: 0 },  // East  
                    { dx: 0, dy: 1 },  // South
                    { dx: -1, dy: 0 }  // West
                ];
                
                for (const {dx, dy} of neighbors) {
                    const nx = gx + dx;
                    const ny = gy + dy;
                    
                    if (ny >= 0 && ny < terrain.grid.length && 
                        nx >= 0 && nx < terrain.grid[ny].length) {
                        
                        const neighborTerrain = terrain.grid[ny][nx];
                        
                        if (this.shouldBlendTerrains(currentTerrain, neighborTerrain)) {
                            this.renderSoftTransition(currentTerrain, neighborTerrain, dx, dy, screenX, screenY, cellSize);
                        }
                    }
                }
            }
        }
        
        ctx.restore();
    }
    
    shouldBlendTerrains(terrain1, terrain2) {
        if (terrain1 === terrain2) return false;
        
        // Define which terrain types should have soft transitions
        const blendPairs = [
            ['open', 'forest'],
            ['open', 'road'],
            ['open', 'ruins'],
            ['water', 'open'],
            ['road', 'bridge']
        ];
        
        return blendPairs.some(([a, b]) => 
            (terrain1 === a && terrain2 === b) || (terrain1 === b && terrain2 === a)
        );
    }
    
    renderSoftTransition(fromTerrain, toTerrain, dx, dy, screenX, screenY, cellSize) {
        const ctx = this.ctx;
        
        // Create a soft gradient transition only at the actual edge
        const gradient = this.createEdgeGradient(fromTerrain, toTerrain, dx, dy, screenX, screenY, cellSize);
        
        if (gradient) {
            ctx.fillStyle = gradient;
            
            // Create transition area based on direction
            if (dx === 1) { // Right edge
                ctx.fillRect(screenX + cellSize * 0.8, screenY, cellSize * 0.2, cellSize);
            } else if (dx === -1) { // Left edge  
                ctx.fillRect(screenX, screenY, cellSize * 0.2, cellSize);
            } else if (dy === 1) { // Bottom edge
                ctx.fillRect(screenX, screenY + cellSize * 0.8, cellSize, cellSize * 0.2);
            } else if (dy === -1) { // Top edge
                ctx.fillRect(screenX, screenY, cellSize, cellSize * 0.2);
            }
        }
    }
    
    createEdgeGradient(fromTerrain, toTerrain, dx, dy, x, y, size) {
        const ctx = this.ctx;
        
        const fromColor = this.getTerrainBaseColor(fromTerrain);
        const toColor = this.getTerrainBaseColor(toTerrain);
        
        let gradient;
        
        if (dx !== 0) { // Horizontal transition
            gradient = ctx.createLinearGradient(x, y, x + size, y);
            if (dx === 1) { // Transitioning right
                gradient.addColorStop(0, 'transparent');
                gradient.addColorStop(0.7, 'transparent');
                gradient.addColorStop(1, toColor + '40'); // 40 = 25% alpha
            } else { // Transitioning left
                gradient.addColorStop(0, toColor + '40');
                gradient.addColorStop(0.3, 'transparent');
                gradient.addColorStop(1, 'transparent');
            }
        } else { // Vertical transition
            gradient = ctx.createLinearGradient(x, y, x, y + size);
            if (dy === 1) { // Transitioning down
                gradient.addColorStop(0, 'transparent');
                gradient.addColorStop(0.7, 'transparent');
                gradient.addColorStop(1, toColor + '40');
            } else { // Transitioning up
                gradient.addColorStop(0, toColor + '40');
                gradient.addColorStop(0.3, 'transparent');
                gradient.addColorStop(1, 'transparent');
            }
        }
        
        return gradient;
    }

    renderOverlayObjects(terrain, startX, startY, endX, endY, viewport, cellSize) {
        const ctx = this.ctx;
        
        for (let gy = startY; gy < endY; gy++) {
            for (let gx = startX; gx < endX; gx++) {
                if (gy >= terrain.grid.length || gx >= terrain.grid[gy].length) continue;
                
                const terrainType = terrain.grid[gy][gx];
                const density = this.overlayDensity[terrainType];
                
                if (!density) continue;
                
                // Use deterministic random for consistent placement
                const seed = gx * 1000 + gy;
                if (this.seededRandom(seed) < density) {
                    this.renderOverlayForTerrain(terrainType, gx, gy, viewport, cellSize, seed);
                }
            }
        }
    }

    renderOverlayForTerrain(terrainType, gx, gy, viewport, cellSize, seed) {
        const ctx = this.ctx;
        let spriteKey = null;
        
        // Select sprite based on terrain type
        if (terrainType === 'forest') {
            const treeIndex = Math.floor(this.seededRandom(seed + 1) * 3) + 1;
            spriteKey = `tree_${treeIndex}`;
        } else if (terrainType === 'ruins') {
            const rubbleIndex = Math.floor(this.seededRandom(seed + 2) * 2) + 1;
            spriteKey = `rubble_${rubbleIndex}`;
        } else if (terrainType === 'open') {
            const rockIndex = Math.floor(this.seededRandom(seed + 3) * 2) + 1;
            spriteKey = `rock_${rockIndex}`;
        }
        
        const sprite = this.overlayCache.get(spriteKey);
        if (!sprite) return;
        
        // Position within cell with some randomness
        const offsetX = this.seededRandom(seed + 4) * cellSize * 0.6;
        const offsetY = this.seededRandom(seed + 5) * cellSize * 0.6;
        
        const screenX = gx * cellSize + viewport.x + offsetX;
        const screenY = gy * cellSize + viewport.y + offsetY;
        
        ctx.drawImage(sprite, screenX, screenY);
    }

    seededRandom(seed) {
        // Simple seeded random number generator
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
}
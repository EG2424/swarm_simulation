/**
 * 3D Renderer - WebGL-based 3D rendering with Three.js
 * Handles 3D terrain, entities, and camera controls while maintaining compatibility with 2D features
 */

class Renderer3D {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.canvas = null; // Will be set in init()
        
        // Three.js core components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = null;
        
        // Scene groups for organization
        this.sceneGroups = {
            terrain: null,
            entities: null,
            ranges: null,
            routes: null,
            gizmos: null
        };
        
        // Rendering settings
        this.entityScale = 1.0;
        this.showDetectionRanges = false;
        this.showPatrolRoutes = true;
        this.showTerrain = true;
        
        // Entity management
        this.entities = [];
        this.selectedEntityIds = [];
        this.entityMeshes = new Map(); // entity.id -> mesh
        
        // Terrain system
        this.terrainProvider = null;
        this.terrainMesh = null;
        
        // Camera controller
        this.cameraController = null;
        
        // Performance tracking
        this.isWebGLSupported = this.checkWebGLSupport();
        this.frameCount = 0;
        this.lastFPSUpdate = Date.now();
        
        // Configuration
        this.config = {
            enable3D: true,
            terrain: {
                provider: "heightmap",
                src: "assets/terrain/sample_heightmap.png",
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
        };
        
        // Don't call init() in constructor - will be called explicitly
    }
    
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!context;
        } catch (e) {
            return false;
        }
    }
    
    async init() {
        if (!this.isWebGLSupported) {
            console.warn('WebGL not supported, 3D renderer disabled');
            return false;
        }
        
        try {
            console.log('Starting 3D renderer initialization...');
            
            // Get fresh canvas element
            this.canvas = document.getElementById(this.canvasId);
            if (!this.canvas) {
                throw new Error(`Canvas element with id '${this.canvasId}' not found`);
            }
            
            console.log('Canvas element found:', this.canvas.constructor.name);
            
            // Wait for Three.js to be available
            await this.loadThreeJS();
            
            // Check if Three.js is really available
            if (typeof THREE === 'undefined') {
                throw new Error('Three.js failed to load properly');
            }
            
            console.log('Initializing Three.js scene...');
            this.initScene();
            
            console.log('Initializing camera...');
            this.initCamera();
            
            console.log('Initializing renderer...');
            this.initRenderer();
            
            console.log('Initializing raycaster...');
            this.initRaycaster();
            
            console.log('Initializing scene groups...');
            this.initSceneGroups();
            
            console.log('Initializing camera controller...');
            this.cameraController = new CameraController3D(this.camera, this.canvas, this.config.camera);
            
            console.log('Initializing terrain provider...');
            this.terrainProvider = new HeightmapTerrainProvider(this.config.terrain);
            await this.terrainProvider.init();
            
            console.log('Loading terrain mesh...');
            await this.loadTerrain();
            
            console.log('Setting up event listeners...');
            this.setupEventListeners();
            
            console.log('3D renderer initialized successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to initialize 3D renderer:', error);
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
            return false;
        }
    }
    
    async loadThreeJS() {
        // Check if Three.js is already loaded
        if (typeof THREE !== 'undefined') {
            console.log('Three.js already loaded');
            return;
        }
        
        console.log('Loading Three.js...');
        
        // Try multiple CDNs in order
        const cdnUrls = [
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r158/three.min.js',
            'https://unpkg.com/three@0.158.0/build/three.min.js',
            'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js'
        ];
        
        for (let i = 0; i < cdnUrls.length; i++) {
            try {
                console.log(`Trying CDN ${i + 1}: ${cdnUrls[i]}`);
                await this.loadThreeFromUrl(cdnUrls[i]);
                
                if (typeof THREE !== 'undefined') {
                    console.log(`Three.js loaded successfully from CDN ${i + 1}`);
                    return;
                }
            } catch (error) {
                console.warn(`CDN ${i + 1} failed:`, error.message);
                if (i === cdnUrls.length - 1) {
                    throw new Error('All CDNs failed to load Three.js');
                }
            }
        }
    }
    
    loadThreeFromUrl(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.timeout = 10000; // 10 second timeout
            
            const timeout = setTimeout(() => {
                script.remove();
                reject(new Error('Timeout loading Three.js'));
            }, 10000);
            
            script.onload = () => {
                clearTimeout(timeout);
                resolve();
            };
            
            script.onerror = (error) => {
                clearTimeout(timeout);
                script.remove();
                reject(new Error(`Failed to load from ${url}`));
            };
            
            document.head.appendChild(script);
        });
    }
    
    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a); // Match dark theme
        
        // Disable all scene helpers and debugging
        this.scene.autoUpdate = true;
        this.scene.matrixAutoUpdate = true;
        
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Add directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 200, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }
    
    initCamera() {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 1, 10000);
        this.camera.position.set(400, 200, 400);
        this.camera.lookAt(400, 0, 300); // Look at center of typical arena
    }
    
    initRenderer() {
        console.log('Initializing Three.js WebGL renderer...');
        
        // Check canvas state without creating contexts
        console.log('Canvas width:', this.canvas.width, 'height:', this.canvas.height);
        console.log('Canvas client width:', this.canvas.clientWidth, 'height:', this.canvas.clientHeight);
        
        // Ensure canvas has proper dimensions
        if (this.canvas.clientWidth > 0 && this.canvas.clientHeight > 0) {
            // Set internal dimensions to match client dimensions
            if (this.canvas.width !== this.canvas.clientWidth || this.canvas.height !== this.canvas.clientHeight) {
                this.canvas.width = this.canvas.clientWidth;
                this.canvas.height = this.canvas.clientHeight;
                console.log('Updated canvas dimensions to match client size');
            }
        } else {
            console.warn('Canvas has zero dimensions, setting defaults');
            this.canvas.width = 800;
            this.canvas.height = 600;
        }
        
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: false,
                preserveDrawingBuffer: false
            });
            
            console.log('WebGL renderer created successfully');
            
            // Set proper size and pixel ratio
            const width = this.canvas.clientWidth;
            const height = this.canvas.clientHeight;
            
            console.log(`Setting renderer size: ${width}x${height}`);
            this.renderer.setSize(width, height, false); // Don't update canvas style
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            
            // Configure rendering settings
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            
            // Disable all possible Three.js debugging features
            if (this.renderer.debug) {
                this.renderer.debug.checkShaderErrors = false;
            }
            
            // Check for any global wireframe settings
            console.log('Renderer wireframe settings:', {
                shadows: this.renderer.shadowMap.enabled,
                context: !!this.renderer.getContext()
            });
            
            // Ensure the WebGL context is active
            const gl = this.renderer.getContext();
            if (!gl) {
                throw new Error('Failed to get WebGL context from Three.js renderer');
            }
            
            console.log('WebGL context obtained:', gl.constructor.name);
            
        } catch (error) {
            console.error('Failed to create WebGL renderer:', error);
            throw error;
        }
    }
    
    initRaycaster() {
        this.raycaster = new THREE.Raycaster();
    }
    
    initSceneGroups() {
        this.sceneGroups.terrain = new THREE.Group();
        this.sceneGroups.terrain.name = 'TerrainGroup';
        this.scene.add(this.sceneGroups.terrain);
        
        this.sceneGroups.entities = new THREE.Group();
        this.sceneGroups.entities.name = 'EntitiesGroup';
        this.scene.add(this.sceneGroups.entities);
        
        this.sceneGroups.ranges = new THREE.Group();
        this.sceneGroups.ranges.name = 'RangesGroup';
        this.scene.add(this.sceneGroups.ranges);
        
        this.sceneGroups.routes = new THREE.Group();
        this.sceneGroups.routes.name = 'RoutesGroup';
        this.scene.add(this.sceneGroups.routes);
        
        this.sceneGroups.gizmos = new THREE.Group();
        this.sceneGroups.gizmos.name = 'GizmosGroup';
        this.scene.add(this.sceneGroups.gizmos);
    }
    
    async loadTerrain() {
        if (!this.terrainProvider) {
            console.warn('No terrain provider available');
            return;
        }
        
        try {
            this.terrainMesh = await this.terrainProvider.buildMesh({
                lod: this.config.terrain.lod,
                wireframe: false
            });
            
            if (this.terrainMesh) {
                this.sceneGroups.terrain.add(this.terrainMesh);
                this.terrainMesh.receiveShadow = true;
                console.log('Terrain mesh loaded successfully');
            }
        } catch (error) {
            console.error('Failed to load terrain:', error);
        }
    }
    
    setupEventListeners() {
        // Handle canvas resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Handle mouse events for selection
        this.canvas.addEventListener('click', (e) => {
            if (!this.cameraController.isDragging) {
                this.handleCanvasClick(e);
            }
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
    }
    
    handleResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        this.raycaster.setFromCamera(mouse, this.camera);
        
        // Check for entity intersections first
        const entityMeshes = Array.from(this.entityMeshes.values());
        const entityIntersects = this.raycaster.intersectObjects(entityMeshes);
        
        if (entityIntersects.length > 0) {
            // Entity clicked
            const clickedMesh = entityIntersects[0].object;
            const entityId = this.getEntityIdFromMesh(clickedMesh);
            if (entityId) {
                this.handleEntityClick(entityId, e.shiftKey);
            }
        } else {
            // Terrain clicked - for movement commands
            const terrainIntersects = this.raycaster.intersectObject(this.terrainMesh);
            if (terrainIntersects.length > 0) {
                const worldPos = terrainIntersects[0].point;
                this.handleTerrainClick(worldPos, e.ctrlKey);
            }
        }
    }
    
    handleMouseMove(e) {
        // Handle hover effects and tooltips
        const rect = this.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        this.raycaster.setFromCamera(mouse, this.camera);
        
        // Check for entity hover
        const entityMeshes = Array.from(this.entityMeshes.values());
        const intersects = this.raycaster.intersectObjects(entityMeshes);
        
        if (intersects.length > 0) {
            this.canvas.style.cursor = 'pointer';
            // TODO: Show tooltip
        } else {
            this.canvas.style.cursor = 'default';
        }
    }
    
    handleKeyDown(e) {
        switch (e.code) {
            case 'KeyR':
                if (this.cameraController) {
                    this.cameraController.reset();
                }
                break;
            case 'KeyF':
                if (this.cameraController) {
                    this.cameraController.toggleFlyMode();
                }
                break;
            case 'KeyH':
                this.toggleHelpOverlay();
                break;
        }
    }
    
    handleEntityClick(entityId, shiftKey) {
        // Mirror 2D selection behavior
        if (window.wsManager) {
            window.wsManager.selectEntity(entityId, true, shiftKey);
        }
    }
    
    handleTerrainClick(worldPos, isAppend) {
        // Send movement commands for selected entities
        if (this.selectedEntityIds.length > 0 && window.wsManager) {
            const target = { x: worldPos.x, y: worldPos.z }; // Convert 3D to 2D coords
            
            for (const entityId of this.selectedEntityIds) {
                const entity = this.entities.find(e => e.id === entityId);
                if (!entity || entity.destroyed) continue;
                
                let command;
                if (isAppend && entity.patrol_route && entity.patrol_route.length > 0) {
                    // Ctrl+Click: Append to existing route
                    const newRoute = [...entity.patrol_route, target];
                    command = {
                        mode: 'waypoint_mode',
                        patrol_route: newRoute
                    };
                } else {
                    // Normal Click: Move to single waypoint
                    command = {
                        mode: 'waypoint_mode',
                        patrol_route: [target]
                    };
                }
                
                window.wsManager.commandEntity(entityId, command);
            }
        }
    }
    
    getEntityIdFromMesh(mesh) {
        // Find entity ID from mesh user data
        for (const [entityId, entityMesh] of this.entityMeshes.entries()) {
            if (entityMesh === mesh || entityMesh.children.includes(mesh)) {
                return entityId;
            }
        }
        return null;
    }
    
    // Public API methods
    updateEntities(entities, selectedEntityIds = []) {
        this.entities = entities || [];
        this.selectedEntityIds = selectedEntityIds || [];
        this.updateEntityMeshes();
    }
    
    updateEntityMeshes() {
        // Check if scene groups are initialized
        if (!this.sceneGroups || !this.sceneGroups.entities) {
            console.warn('Scene groups not initialized, skipping entity mesh update');
            return;
        }
        
        // Remove old meshes
        this.sceneGroups.entities.clear();
        this.entityMeshes.clear();
        
        // Add current entities
        for (const entity of this.entities) {
            const mesh = this.createEntityMesh(entity);
            if (mesh) {
                this.sceneGroups.entities.add(mesh);
                this.entityMeshes.set(entity.id, mesh);
                
                // Update position with terrain height
                const y = this.terrainProvider ? 
                    this.terrainProvider.elevationAt(entity.position.x, entity.position.y) : 0;
                mesh.position.set(entity.position.x, y + 2, entity.position.y);
                
            }
        }
        
        // Temporarily disable selection highlights to test blue rectangles
        // this.updateSelectionHighlights();
        
        // Update detection ranges and patrol routes
        if (this.showDetectionRanges) {
            this.updateDetectionRanges();
        }
        
        // Update patrol routes (only for selected entities)
        if (this.showPatrolRoutes) {
            this.updatePatrolRoutes();
        }
    }
    
    createEntityMesh(entity) {
        // Create billboard or simple mesh based on entity type
        const size = 8 * this.entityScale;
        
        // Use geometry cache for better performance
        const geometryKey = `plane_${size}`;
        if (!this.geometryCache) this.geometryCache = new Map();
        
        let geometry = this.geometryCache.get(geometryKey);
        if (!geometry) {
            geometry = new THREE.PlaneGeometry(size, size);
            this.geometryCache.set(geometryKey, geometry);
        }
        
        // Parse the color properly - entity.color might be a hex string
        let color = entity.color;
        if (typeof color === 'string' && color.startsWith('#')) {
            color = parseInt(color.replace('#', '0x'), 16);
        }
        
        // Debug tanks specifically - tanks might be getting wrong colors
        if (entity.type === 'tank') {
            console.log(`Tank ${entity.id.substring(0,8)}: original color=${entity.color}, parsed color=${color.toString(16)}`);
            
            // Force tank color to be red to test
            color = 0xFF0000; // Force red for debugging
        }
        
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: entity.destroyed ? 0.5 : 1.0
            // Completely remove wireframe property - let Three.js handle it naturally
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.entityId = entity.id;
        mesh.userData.entityType = entity.type;
        
        // Enable frustum culling
        mesh.frustumCulled = true;
        
        // Make billboard face camera
        mesh.lookAt(this.camera.position);
        
        return mesh;
    }
    
    updateSelectionHighlights() {
        for (const [entityId, mesh] of this.entityMeshes.entries()) {
            const isSelected = this.selectedEntityIds.includes(entityId);
            
            // Debug selection states
            if (mesh.userData.entityType === 'tank') {
                console.log(`Tank ${entityId.substring(0,8)}: isSelected=${isSelected}, selectedIds=${this.selectedEntityIds.length}`);
            }
            
            if (isSelected) {
                // Add selection glow/outline
                if (!mesh.userData.selectionHelper) {
                    const outlineGeometry = new THREE.RingGeometry(10, 12, 16);
                    const outlineMaterial = new THREE.MeshBasicMaterial({
                        color: 0xFFD700,
                        transparent: true,
                        opacity: 0.8
                    });
                    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
                    outline.rotation.x = -Math.PI / 2; // Lay flat on ground
                    outline.position.y = -1.5; // Slightly below entity
                    mesh.add(outline);
                    mesh.userData.selectionHelper = outline;
                }
            } else {
                // Remove selection helper
                if (mesh.userData.selectionHelper) {
                    mesh.remove(mesh.userData.selectionHelper);
                    mesh.userData.selectionHelper = null;
                }
            }
        }
    }
    
    updateDetectionRanges() {
        if (!this.sceneGroups || !this.sceneGroups.ranges) {
            console.warn('Scene groups not initialized, skipping detection ranges update');
            return;
        }
        
        this.sceneGroups.ranges.clear();
        
        if (!this.showDetectionRanges) return;
        
        for (const entity of this.entities) {
            if (entity.type === 'drone' && !entity.destroyed) {
                const range = this.createDetectionRange(entity);
                if (range) {
                    this.sceneGroups.ranges.add(range);
                }
            }
        }
    }
    
    createDetectionRange(entity) {
        const radius = 40; // Detection radius from entities.py
        const segments = 64;
        const points = [];
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = entity.position.x + Math.cos(angle) * radius;
            const z = entity.position.y + Math.sin(angle) * radius;
            const y = this.terrainProvider ? 
                this.terrainProvider.elevationAt(x, z) + 0.5 : 0.5;
            
            points.push(new THREE.Vector3(x, y, z));
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0xFF9F0A,
            transparent: true,
            opacity: 0.6
        });
        
        return new THREE.Line(geometry, material);
    }
    
    updatePatrolRoutes() {
        if (!this.sceneGroups || !this.sceneGroups.routes) {
            console.warn('Scene groups not initialized, skipping patrol routes update');
            return;
        }
        
        this.sceneGroups.routes.clear();
        
        if (!this.showPatrolRoutes) return;
        
        // Only show patrol routes for SELECTED entities (like 2D mode)
        for (const entity of this.entities) {
            const isSelected = this.selectedEntityIds.includes(entity.id);
            if (isSelected && entity.patrol_route && entity.patrol_route.length > 0) {
                const route = this.createPatrolRoute(entity);
                if (route) {
                    this.sceneGroups.routes.add(route);
                }
            }
        }
    }
    
    createPatrolRoute(entity) {
        const points = [];
        
        for (const waypoint of entity.patrol_route) {
            const y = this.terrainProvider ? 
                this.terrainProvider.elevationAt(waypoint.x, waypoint.y) + 1 : 1;
            points.push(new THREE.Vector3(waypoint.x, y, waypoint.y));
        }
        
        // Close the loop if multiple waypoints
        if (points.length > 2) {
            points.push(points[0]);
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const isSelected = this.selectedEntityIds.includes(entity.id);
        const material = new THREE.LineBasicMaterial({
            color: isSelected ? 0xFFD700 : 0x007AFF,
            transparent: true,
            opacity: isSelected ? 0.9 : 0.6,
            linewidth: isSelected ? 3 : 1
        });
        
        return new THREE.Line(geometry, material);
    }
    
    // Layer toggle methods
    setShowTerrain(show) {
        this.showTerrain = show;
        this.sceneGroups.terrain.visible = show;
    }
    
    setShowDetectionRanges(show) {
        this.showDetectionRanges = show;
        this.updateDetectionRanges();
    }
    
    setShowPatrolRoutes(show) {
        this.showPatrolRoutes = show;
        this.updatePatrolRoutes();
    }
    
    setEntityScale(scale) {
        this.entityScale = Math.max(0.1, Math.min(5.0, scale));
        this.updateEntityMeshes();
    }
    
    // Camera control methods
    setCameraDistance(distance) {
        if (this.cameraController) {
            this.cameraController.setDistance(distance);
        }
    }
    
    toggleHelpOverlay() {
        if (window.helpOverlay) {
            window.helpOverlay.toggle();
        } else {
            console.log('3D Controls Help:\nLMB: Orbit\nRMB: Pan\nWheel: Zoom\nWASD: Move\nQ/E: Altitude\nR: Reset\nF: Fly mode\nH: Toggle help');
        }
    }
    
    // Main render loop
    render() {
        if (!this.renderer || !this.scene || !this.camera) {
            console.warn('3D render called but components not ready:', {
                renderer: !!this.renderer,
                scene: !!this.scene,
                camera: !!this.camera
            });
            return;
        }
        
        // Ensure canvas context is correct
        if (this.canvas && this.canvas.getContext && this.renderer.domElement !== this.canvas) {
            console.warn('Canvas context mismatch detected in 3D render');
            return;
        }
        
        // Update camera controller
        if (this.cameraController) {
            this.cameraController.update();
        }
        
        // Update entity billboard rotations to face camera
        for (const mesh of this.entityMeshes.values()) {
            mesh.lookAt(this.camera.position);
        }
        
        // Render the scene
        try {
            this.renderer.render(this.scene, this.camera);
        } catch (error) {
            console.error('3D render failed:', error);
            return;
        }
        
        // Update performance metrics
        this.updatePerformanceMetrics();
    }
    
    updatePerformanceMetrics() {
        this.frameCount++;
        const now = Date.now();
        
        if (now - this.lastFPSUpdate >= 1000) {
            // FPS calculation handled by main app
            this.frameCount = 0;
            this.lastFPSUpdate = now;
        }
    }
    
    // Reset method for simulation resets
    reset() {
        console.log('Resetting 3D renderer...');
        
        try {
            // Clear all entities
            this.entities = [];
            this.selectedEntityIds = [];
            this.entityMeshes.clear();
            
            // Clear scene groups
            if (this.sceneGroups.entities) {
                this.sceneGroups.entities.clear();
            }
            if (this.sceneGroups.ranges) {
                this.sceneGroups.ranges.clear();
            }
            if (this.sceneGroups.routes) {
                this.sceneGroups.routes.clear();
            }
            if (this.sceneGroups.gizmos) {
                this.sceneGroups.gizmos.clear();
            }
            
            // Reset camera to default position
            if (this.cameraController) {
                this.cameraController.reset();
            }
            
            console.log('3D renderer reset complete');
        } catch (error) {
            console.error('Error during 3D renderer reset:', error);
        }
    }
    
    // Cleanup
    dispose() {
        console.log('Disposing 3D renderer...');
        
        try {
            // Reset first
            this.reset();
            
            // Dispose renderer
            if (this.renderer) {
                // Properly dispose WebGL context
                const gl = this.renderer.getContext();
                if (gl) {
                    const loseContext = gl.getExtension('WEBGL_lose_context');
                    if (loseContext) {
                        loseContext.loseContext();
                    }
                }
                
                this.renderer.dispose();
                this.renderer = null;
            }
            
            // Dispose camera controller
            if (this.cameraController) {
                this.cameraController.dispose();
                this.cameraController = null;
            }
            
            // Clear geometry cache
            if (this.geometryCache) {
                for (const geometry of this.geometryCache.values()) {
                    geometry.dispose();
                }
                this.geometryCache.clear();
            }
            
            // Clean up scene
            if (this.scene) {
                this.scene.clear();
                this.scene = null;
            }
            
            // Clear terrain
            this.terrainProvider = null;
            this.terrainMesh = null;
            
            console.log('3D renderer disposed');
        } catch (error) {
            console.error('Error during 3D renderer disposal:', error);
        }
    }
}

// Global 3D renderer instance
window.renderer3D = null;
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
        
        // AoE3-style interaction state
        this.dragSelection = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            shiftKey: false
        };
        
        // Camera control state
        this.cameraControl = {
            active: false,
            mode: null, // 'orbit' or 'pan'
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0
        };
        
        // Double-click detection
        this.lastClickTime = 0;
        this.lastClickEntity = null;
        this.doubleClickThreshold = 300; // ms
        this.doubleClickRadius = 100; // world units
        
        // Key state tracking
        this.keys = {
            altPressed: false
        };
        
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
        
        // AoE3-style mouse events - use capture phase to handle before camera controller
        this.canvas.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        }, true); // true = capture phase
        
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        }, true); // true = capture phase
        
        this.canvas.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        }, true); // true = capture phase
        
        this.canvas.addEventListener('click', (e) => {
            if (!this.dragSelection.active && !this.cameraControl.active) {
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
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        document.addEventListener('keyup', (e) => {
            this.handleKeyUp(e);
        });
        
        // Prevent text selection while dragging
        this.canvas.addEventListener('selectstart', (e) => {
            e.preventDefault();
        });
    }
    
    handleResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    // AoE3-style mouse event handlers
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        // Fusion 360 style camera controls
        const isFusionCameraControl = (
            e.button === 1 || // Middle mouse orbit
            (e.button === 0 && e.shiftKey) || // Shift+Left pan
            e.button === 2 // Right pan
        );
        
        if (isFusionCameraControl) {
            // Fusion 360 camera control
            this.startCameraControl(e, screenX, screenY);
        } else if (e.button === 0 && !e.shiftKey) {
            // Left mouse without Shift = Unit selection
            const clickedEntity = this.getEntityAtPosition(screenX, screenY);
            
            if (clickedEntity) {
                // Entity clicked - handle selection
                console.log('Entity clicked:', clickedEntity.id);
                this.handleEntityClick(clickedEntity.id, e.shiftKey);
            } else {
                // Empty space clicked - start drag selection
                console.log('Empty space clicked - starting drag selection');
                this.startDragSelection(screenX, screenY, e.shiftKey);
            }
            
            // Prevent camera controller from handling this event
            e.preventDefault();
            e.stopPropagation();
        }
        
        e.preventDefault();
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        if (this.cameraControl.active) {
            // Alt+drag = Camera movement
            this.updateCameraControl(e, screenX, screenY);
            e.preventDefault();
            e.stopPropagation();
        } else if (this.dragSelection.active) {
            // Normal drag = Selection box
            this.updateDragSelection(screenX, screenY);
            e.preventDefault();
            e.stopPropagation();
        } else {
            // Handle cursor and hover effects
            this.handleCanvasMouseMove(screenX, screenY);
        }
    }
    
    handleMouseUp(e) {
        if (this.cameraControl.active) {
            this.endCameraControl();
        } else if (this.dragSelection.active) {
            this.completeDragSelection(e.shiftKey);
        }
        
        // Prevent event propagation to camera controller
        e.preventDefault();
        e.stopPropagation();
    }
    
    handleCanvasClick(e) {
        // This is called for single clicks that aren't part of drag operations
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        // For click events that weren't handled by mousedown/up
        if (!e.altKey && e.button === 0) {
            const clickedEntity = this.getEntityAtPosition(screenX, screenY);
            if (!clickedEntity) {
                // Clear selection on empty click (if not shift)
                if (!e.shiftKey && this.selectedEntityIds.length > 0) {
                    for (const entityId of this.selectedEntityIds) {
                        if (window.wsManager) {
                            window.wsManager.selectEntity(entityId, false, false);
                        }
                    }
                }
            }
        }
    }
    
    handleDoubleClick(e) {
        if (e.altKey) return; // Ignore in camera mode
        
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        const clickedEntity = this.getEntityAtPosition(screenX, screenY);
        if (clickedEntity) {
            this.selectAllSameTypeUnits(clickedEntity);
        }
    }
    
    handleRightClick(e) {
        if (e.altKey) {
            // Alt+right-click = Camera pan (handled in camera control)
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        const clickedEntity = this.getEntityAtPosition(screenX, screenY);
        
        if (clickedEntity) {
            // Right-clicked on entity - could add context menu here
            return;
        } else if (this.selectedEntityIds.length > 0) {
            // Right-clicked on terrain with units selected - move command
            const worldPos = this.getWorldPositionFromScreen(screenX, screenY);
            if (worldPos) {
                this.handleMoveCommand(worldPos, e.ctrlKey);
            }
        }
    }
    
    // Helper methods for AoE3-style controls
    getEntityAtPosition(screenX, screenY) {
        const mouse = new THREE.Vector2(
            (screenX / this.canvas.clientWidth) * 2 - 1,
            -(screenY / this.canvas.clientHeight) * 2 + 1
        );
        
        this.raycaster.setFromCamera(mouse, this.camera);
        
        // Check for entity intersections
        const entityMeshes = Array.from(this.entityMeshes.values());
        const intersects = this.raycaster.intersectObjects(entityMeshes);
        
        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const entityId = this.getEntityIdFromMesh(clickedMesh);
            if (entityId) {
                return this.entities.find(e => e.id === entityId);
            }
        }
        
        return null;
    }
    
    getWorldPositionFromScreen(screenX, screenY) {
        const mouse = new THREE.Vector2(
            (screenX / this.canvas.clientWidth) * 2 - 1,
            -(screenY / this.canvas.clientHeight) * 2 + 1
        );
        
        this.raycaster.setFromCamera(mouse, this.camera);
        
        // Intersect with terrain
        if (this.terrainMesh) {
            const intersects = this.raycaster.intersectObject(this.terrainMesh);
            if (intersects.length > 0) {
                return intersects[0].point;
            }
        }
        
        return null;
    }
    
    handleCanvasMouseMove(screenX, screenY) {
        // Handle cursor changes and hover effects
        if (this.cameraControl.active || this.dragSelection.active) {
            // Don't change cursor during active operations
            return;
        }
        
        const entity = this.getEntityAtPosition(screenX, screenY);
        
        if (entity && !this.isAltPressed()) {
            this.canvas.style.cursor = 'pointer';
        } else if (this.isAltPressed()) {
            this.canvas.style.cursor = 'grab';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }
    
    isAltPressed() {
        // Check if Alt key is currently pressed using our tracked state
        return this.keys.altPressed;
    }
    
    // Camera control methods
    startCameraControl(e, screenX, screenY) {
        this.cameraControl.active = true;
        
        // Fusion 360-style button mapping
        switch (e.button) {
            case 0: // Shift+Left = Pan
                this.cameraControl.mode = 'pan';
                this.canvas.style.cursor = 'move';
                break;
            case 1: // Middle = Orbit/Rotate
                this.cameraControl.mode = 'orbit';
                this.canvas.style.cursor = 'grabbing';
                break;
            case 2: // Right = Pan
                this.cameraControl.mode = 'pan';
                this.canvas.style.cursor = 'move';
                break;
        }
        
        this.cameraControl.startX = screenX;
        this.cameraControl.startY = screenY;
        this.cameraControl.lastX = screenX;
        this.cameraControl.lastY = screenY;
        
        // Enable external control mode to disable camera controller's mouse handling
        if (this.cameraController) {
            this.cameraController.setExternalControl(true);
        }
    }
    
    updateCameraControl(e, screenX, screenY) {
        if (!this.cameraControl.active || !this.cameraController) return;
        
        const deltaX = screenX - this.cameraControl.lastX;
        const deltaY = screenY - this.cameraControl.lastY;
        
        // Fusion 360-style controls
        switch (this.cameraControl.mode) {
            case 'orbit': // Middle = Rotate/Orbit
                this.cameraController.handleOrbitMouseMove(deltaX, deltaY);
                break;
            case 'pan': // Shift+Left or Right = Pan
                this.cameraController.panCamera(deltaX, deltaY);
                break;
        }
        
        this.cameraControl.lastX = screenX;
        this.cameraControl.lastY = screenY;
    }
    
    endCameraControl() {
        this.cameraControl.active = false;
        this.cameraControl.mode = null;
        
        // Restore cursor
        this.canvas.style.cursor = 'default';
        
        // Disable external control mode to re-enable camera controller's mouse handling
        if (this.cameraController) {
            this.cameraController.setExternalControl(false);
        }
    }
    
    // Selection methods (ported from 2D renderer)
    startDragSelection(screenX, screenY, shiftKey) {
        this.dragSelection.active = true;
        this.dragSelection.startX = screenX;
        this.dragSelection.startY = screenY;
        this.dragSelection.currentX = screenX;
        this.dragSelection.currentY = screenY;
        this.dragSelection.shiftKey = shiftKey;
        
        // Completely disable camera controller during selection
        if (this.cameraController) {
            this.cameraController.setExternalControl(true);
            this.cameraController.isDragging = false; // Force stop any camera dragging
            this.cameraController.dragButton = -1;
        }
        
        console.log('Started drag selection, camera controller disabled');
    }
    
    updateDragSelection(screenX, screenY) {
        if (!this.dragSelection.active) return;
        
        this.dragSelection.currentX = screenX;
        this.dragSelection.currentY = screenY;
    }
    
    async completeDragSelection(shiftKey) {
        if (!this.dragSelection.active) return;
        
        // Check if this was actually a drag or just a click
        const dragDistance = Math.abs(this.dragSelection.currentX - this.dragSelection.startX) + 
                            Math.abs(this.dragSelection.currentY - this.dragSelection.startY);
        const isActualDrag = dragDistance > 3; // Minimum pixels for a drag
        
        if (isActualDrag) {
            // Convert screen coordinates to world space for selection box
            const startMouse = new THREE.Vector2(
                (this.dragSelection.startX / this.canvas.clientWidth) * 2 - 1,
                -(this.dragSelection.startY / this.canvas.clientHeight) * 2 + 1
            );
            
            const endMouse = new THREE.Vector2(
                (this.dragSelection.currentX / this.canvas.clientWidth) * 2 - 1,
                -(this.dragSelection.currentY / this.canvas.clientHeight) * 2 + 1
            );
            
            // Find entities in selection box using frustum selection
            const entitiesInBox = this.getEntitiesInSelectionBox(startMouse, endMouse);
            
            console.log('Drag selection completed. Entities in box:', entitiesInBox.length, 'ShiftKey:', shiftKey);
            
            // Apply selection for drag operation
            if (!shiftKey && !this.dragSelection.shiftKey) {
                // Clear existing selection first - make a copy of the array to avoid modification during iteration
                const currentlySelected = [...this.selectedEntityIds];
                console.log('Clearing existing selection:', currentlySelected);
                
                for (const entityId of currentlySelected) {
                    if (window.wsManager) {
                        console.log('Deselecting entity:', entityId);
                        window.wsManager.selectEntity(entityId, false, false);
                    }
                }
                
                // Wait a frame to ensure deselection is processed
                await new Promise(resolve => requestAnimationFrame(resolve));
            }
            
            // Select entities in box
            console.log('Selecting entities in box:', entitiesInBox.map(e => e.id));
            for (const entity of entitiesInBox) {
                if (window.wsManager) {
                    console.log('Selecting entity:', entity.id);
                    window.wsManager.selectEntity(entity.id, true, true);
                }
            }
        } else {
            // This was just a click on empty space, not a drag - deselect everything
            console.log('This was a click, not drag. Deselecting entities...');
            if (!shiftKey && !this.dragSelection.shiftKey) {
                console.log('Deselecting', this.selectedEntityIds.length, 'entities');
                for (const entityId of this.selectedEntityIds) {
                    if (window.wsManager) {
                        console.log('Deselecting entity:', entityId);
                        window.wsManager.selectEntity(entityId, false, false);
                    }
                }
                console.log('Deselected all entities due to empty space click');
            } else {
                console.log('Shift key held, not deselecting');
            }
        }
        
        // Reset drag selection
        this.dragSelection.active = false;
        
        // Re-enable camera controller after selection
        if (this.cameraController) {
            this.cameraController.setExternalControl(false);
        }
        
        console.log('Completed drag selection, camera controller re-enabled');
    }
    
    getEntitiesInSelectionBox(startMouse, endMouse) {
        const entitiesInBox = [];
        
        // Create selection frustum
        const minX = Math.min(startMouse.x, endMouse.x);
        const maxX = Math.max(startMouse.x, endMouse.x);
        const minY = Math.min(startMouse.y, endMouse.y);
        const maxY = Math.max(startMouse.y, endMouse.y);
        
        // Check each entity to see if it's in the selection box
        for (const entity of this.entities) {
            if (entity.destroyed) continue;
            
            // Project entity position to screen space
            const entityPos = new THREE.Vector3(entity.position.x, 0, entity.position.y);
            if (this.terrainProvider) {
                entityPos.y = this.terrainProvider.elevationAt(entity.position.x, entity.position.y) + 2;
            }
            
            const screenPos = entityPos.clone().project(this.camera);
            
            // Check if entity is within selection box
            if (screenPos.x >= minX && screenPos.x <= maxX &&
                screenPos.y >= minY && screenPos.y <= maxY &&
                screenPos.z >= -1 && screenPos.z <= 1) { // Within camera frustum
                entitiesInBox.push(entity);
            }
        }
        
        return entitiesInBox;
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
            if (window.wsManager) {
                window.wsManager.selectEntity(entityId, false, false);
            }
        }
        
        // Select all same-type entities
        for (const entity of sameTypeEntities) {
            if (window.wsManager) {
                window.wsManager.selectEntity(entity.id, true, true);
            }
        }
    }
    
    handleMoveCommand(worldPos, isAppend) {
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
    
    handleKeyDown(e) {
        // Track key states
        if (e.code === 'AltLeft' || e.code === 'AltRight') {
            this.keys.altPressed = true;
        }
        
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
    
    handleKeyUp(e) {
        // Track key states
        if (e.code === 'AltLeft' || e.code === 'AltRight') {
            this.keys.altPressed = false;
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
        console.log('3D Renderer - updateEntities called with selectedEntityIds:', selectedEntityIds);
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
        
        // Update selection highlights
        this.updateSelectionHighlights();
        
        // Update selection highlight positions to follow entities
        this.updateSelectionHighlightPositions();
        
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
        console.log('Updating selection highlights for selectedEntityIds:', this.selectedEntityIds);
        
        // First, remove ALL existing selection helpers to ensure clean state
        this.scene.children.forEach(child => {
            if (child.userData && child.userData.isSelectionHelper) {
                this.scene.remove(child);
                // Dispose geometry and material of the ring
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
        
        // Clear all selection helper references
        for (const [entityId, mesh] of this.entityMeshes.entries()) {
            mesh.userData.selectionHelper = null;
        }
        
        // Now add glowing outline effects only for selected entities
        for (const selectedEntityId of this.selectedEntityIds) {
            const mesh = this.entityMeshes.get(selectedEntityId);
            if (!mesh) continue;
            
            console.log(`Creating single circle selection for selected entity ${selectedEntityId}`);
            
            // Create a simple single circle around the entity
            const ringRadius = 12;
            const ringGeometry = new THREE.RingGeometry(ringRadius, ringRadius + 1.5, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0xFFD700, // Golden color
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            
            const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
            ringMesh.rotation.x = -Math.PI / 2; // Lay flat horizontally
            
            // Position the ring at entity location
            ringMesh.position.copy(mesh.position);
            ringMesh.position.y += 1; // Slightly above entity center
            
            // Mark as selection helper
            ringMesh.userData.isSelectionHelper = true;
            ringMesh.userData.entityId = selectedEntityId;
            
            // Add to scene and store reference
            this.scene.add(ringMesh);
            mesh.userData.selectionHelper = ringMesh;
            
            console.log(`Added 3D selection highlight for entity ${selectedEntityId}`);
        }
        
        console.log(`Selection highlights updated: ${this.selectedEntityIds.length} highlights created`);
    }
    
    updateSelectionHighlightPositions() {
        const time = performance.now() * 0.001; // Gentle animation speed
        
        // Update positions of existing selection rings to follow entities
        for (const [entityId, mesh] of this.entityMeshes.entries()) {
            if (mesh.userData.selectionHelper) {
                const ring = mesh.userData.selectionHelper;
                
                // Update ring position to match entity
                ring.position.copy(mesh.position);
                ring.position.y += 1; // Keep slightly above entity center
                
                // Gentle rotation around Y axis
                ring.rotation.z = time * 0.5;
                
                // Subtle pulse animation
                const pulseScale = 1.0 + Math.sin(time * 2) * 0.05;
                ring.scale.setScalar(pulseScale);
                
                // Gentle opacity breathing
                const pulseOpacity = 0.7 + Math.sin(time * 1.5) * 0.2;
                ring.material.opacity = pulseOpacity;
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
        
        // Only show patrol routes for SELECTED entities AND entities in waypoint mode (like 2D mode)
        for (const entity of this.entities) {
            const isSelected = this.selectedEntityIds.includes(entity.id);
            const isInWaypointMode = entity.mode === 'waypoint_mode' || entity.mode === 'patrol_route';
            const hasRoutes = entity.patrol_route && entity.patrol_route.length > 0;
            
            console.log(`Entity ${entity.id}: selected=${isSelected}, mode=${entity.mode}, waypoint_mode=${isInWaypointMode}, routes=${hasRoutes ? entity.patrol_route.length : 0}`);
            
            // Show waypoints for selected entities that have waypoints OR are in waypoint mode
            if (isSelected && isInWaypointMode && hasRoutes) {
                console.log(`Creating patrol route for selected entity ${entity.id} with ${entity.patrol_route.length} waypoints`);
                const route = this.createPatrolRoute(entity);
                if (route) {
                    this.sceneGroups.routes.add(route);
                }
            }
        }
    }
    
    createPatrolRoute(entity) {
        const routeGroup = new THREE.Group();
        const points = [];
        
        // Create route line
        for (const waypoint of entity.patrol_route) {
            const y = this.terrainProvider ? 
                this.terrainProvider.elevationAt(waypoint.x, waypoint.y) + 1 : 1;
            points.push(new THREE.Vector3(waypoint.x, y, waypoint.y));
        }
        
        // Close the loop if multiple waypoints
        if (points.length > 2) {
            points.push(points[0]);
        }
        
        // Create the route line
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const isSelected = this.selectedEntityIds.includes(entity.id);
        const material = new THREE.LineBasicMaterial({
            color: isSelected ? 0xFFD700 : 0x007AFF,
            transparent: true,
            opacity: isSelected ? 0.9 : 0.6,
            linewidth: 3
        });
        
        const routeLine = new THREE.Line(geometry, material);
        routeGroup.add(routeLine);
        
        // Add waypoint markers (enhanced like 2D mode with numbering)
        for (let i = 0; i < entity.patrol_route.length; i++) {
            const waypoint = entity.patrol_route[i];
            const y = this.terrainProvider ? 
                this.terrainProvider.elevationAt(waypoint.x, waypoint.y) + 2 : 2;
            
            const waypointGroup = new THREE.Group();
            waypointGroup.position.set(waypoint.x, y, waypoint.y);
            
            // Create outer white circle (background)
            const outerGeometry = new THREE.CircleGeometry(4, 16);
            const outerMaterial = new THREE.MeshBasicMaterial({
                color: 0xFFFFFF,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            const outerCircle = new THREE.Mesh(outerGeometry, outerMaterial);
            outerCircle.rotation.x = -Math.PI / 2;
            waypointGroup.add(outerCircle);
            
            // Create inner golden circle
            const innerGeometry = new THREE.CircleGeometry(3, 16);
            const innerMaterial = new THREE.MeshBasicMaterial({
                color: isSelected ? 0xFFD700 : 0x007AFF,
                transparent: true,
                opacity: 1.0,
                side: THREE.DoubleSide
            });
            const innerCircle = new THREE.Mesh(innerGeometry, innerMaterial);
            innerCircle.rotation.x = -Math.PI / 2;
            innerCircle.position.y = 0.1; // Slightly above outer circle
            waypointGroup.add(innerCircle);
            
            // Add waypoint number text (billboard to always face camera)
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 64;
            canvas.height = 64;
            
            context.fillStyle = '#000000';
            context.font = 'bold 32px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText((i + 1).toString(), 32, 32);
            
            const texture = new THREE.CanvasTexture(canvas);
            const textMaterial = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true,
                opacity: 0.9
            });
            const textSprite = new THREE.Sprite(textMaterial);
            textSprite.scale.set(4, 4, 1);
            textSprite.position.y = 1; // Above the circles
            waypointGroup.add(textSprite);
            
            routeGroup.add(waypointGroup);
        }
        
        console.log(`Created patrol route for entity ${entity.id} with ${entity.patrol_route.length} waypoints`);
        return routeGroup;
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
        
        // Render 2D overlays (selection box, UI elements)
        this.renderOverlays();
        
        // Update performance metrics
        this.updatePerformanceMetrics();
    }
    
    renderOverlays() {
        // Get 2D context for overlays
        if (!this.overlayCanvas) {
            this.overlayCanvas = document.createElement('canvas');
            this.overlayCanvas.style.position = 'absolute';
            this.overlayCanvas.style.pointerEvents = 'none';
            this.overlayCanvas.style.zIndex = '10';
            this.overlayContext = this.overlayCanvas.getContext('2d');
            this.canvas.parentNode.appendChild(this.overlayCanvas);
        }
        
        // Update overlay canvas size and position to match main canvas exactly
        const rect = this.canvas.getBoundingClientRect();
        const containerRect = this.canvas.parentNode.getBoundingClientRect();
        
        // Position overlay canvas exactly over main canvas
        this.overlayCanvas.style.left = (rect.left - containerRect.left) + 'px';
        this.overlayCanvas.style.top = (rect.top - containerRect.top) + 'px';
        
        if (this.overlayCanvas.width !== rect.width || this.overlayCanvas.height !== rect.height) {
            this.overlayCanvas.width = rect.width;
            this.overlayCanvas.height = rect.height;
            this.overlayCanvas.style.width = rect.width + 'px';
            this.overlayCanvas.style.height = rect.height + 'px';
        }
        
        // Clear overlay
        this.overlayContext.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Draw selection box
        if (this.dragSelection.active) {
            this.drawSelectionBox();
        }
    }
    
    drawSelectionBox() {
        if (!this.dragSelection.active) return;
        
        const ctx = this.overlayContext;
        
        // Use coordinates directly since overlay canvas is positioned exactly over main canvas
        const startX = this.dragSelection.startX;
        const startY = this.dragSelection.startY;
        const endX = this.dragSelection.currentX;
        const endY = this.dragSelection.currentY;
        
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        // Draw selection box (similar to 2D renderer)
        ctx.strokeStyle = '#00AAFF';
        ctx.fillStyle = '#00AAFF20';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dashed line for better visibility
        
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
        
        ctx.setLineDash([]); // Reset line dash
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
            
            // Clean up overlay canvas
            if (this.overlayCanvas) {
                if (this.overlayCanvas.parentNode) {
                    this.overlayCanvas.parentNode.removeChild(this.overlayCanvas);
                }
                this.overlayCanvas = null;
                this.overlayContext = null;
            }
            
            console.log('3D renderer disposed');
        } catch (error) {
            console.error('Error during 3D renderer disposal:', error);
        }
    }
}

// Global 3D renderer instance
window.renderer3D = null;
/**
 * 3D Camera Controller - Handles orbit, pan, tilt, zoom, and fly controls
 */

class CameraController3D {
    constructor(camera, canvas, config = {}) {
        this.camera = camera;
        this.canvas = canvas;
        this.config = {
            mode: 'orbit',
            minDistance: 10,
            maxDistance: 3000,
            minPolarAngle: 0.05,
            maxPolarAngle: 1.45,
            minAltitude: 3,
            mouseSensitivity: 0.005,
            keyboardSpeed: 50,
            zoomSpeed: 0.1,
            ...config
        };
        
        // Camera state
        this.target = new THREE.Vector3(400, 0, 300); // Default arena center
        this.spherical = new THREE.Spherical();
        this.sphericalDelta = new THREE.Spherical();
        
        // Control state
        this.isDragging = false;
        this.dragButton = -1;
        this.lastMousePos = { x: 0, y: 0 };
        this.keys = new Set();
        this.flyMode = false;
        this.externalControl = false; // Initialize external control state
        
        // Fly mode state
        this.flyVelocity = new THREE.Vector3();
        this.flyQuaternion = new THREE.Quaternion();
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        
        // Performance
        this.lastUpdateTime = performance.now();
        
        this.init();
    }
    
    init() {
        // Initialize spherical coordinates from current camera position
        this.updateSphericalFromCamera();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('Camera controller initialized');
    }
    
    updateSphericalFromCamera() {
        const offset = new THREE.Vector3().subVectors(this.camera.position, this.target);
        this.spherical.setFromVector3(offset);
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e), false);
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e), false);
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e), false);
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), false);
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e), false);
        document.addEventListener('keyup', (e) => this.onKeyUp(e), false);
        
        // Context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault(), false);
        
        // Focus handling
        this.canvas.addEventListener('mouseenter', () => {
            this.canvas.focus();
        });
        
        // Make canvas focusable
        this.canvas.tabIndex = -1;
    }
    
    onMouseDown(e) {
        // Don't handle mouse events if external control is active (selection mode)
        if (this.isExternalControlled()) {
            e.stopPropagation();
            return;
        }
        
        // Fusion 360 style: Middle mouse always works, Shift+Left for pan, Right for pan
        const isValidFusionControl = (
            e.button === 1 || // Middle mouse always works for orbit
            (e.button === 0 && e.shiftKey) || // Shift+Left for pan
            e.button === 2 // Right mouse for pan
        );
        
        if (!isValidFusionControl) {
            e.stopPropagation();
            return;
        }
        
        this.isDragging = true;
        this.dragButton = e.button;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        
        this.canvas.style.cursor = this.getCursorForButton(e.button);
        e.preventDefault();
    }
    
    onMouseMove(e) {
        if (!this.isDragging || this.isExternalControlled()) {
            if (this.isExternalControlled()) {
                e.stopPropagation();
            }
            return;
        }
        
        // Fusion 360 validation during move
        const isValidFusionControl = (
            this.dragButton === 1 || // Middle mouse orbit
            (this.dragButton === 0 && e.shiftKey) || // Shift+Left pan
            this.dragButton === 2 // Right pan
        );
        
        if (!isValidFusionControl) {
            // Stop dragging if modifier key was released
            this.isDragging = false;
            this.dragButton = -1;
            this.canvas.style.cursor = 'default';
            e.stopPropagation();
            return;
        }
        
        const deltaX = e.clientX - this.lastMousePos.x;
        const deltaY = e.clientY - this.lastMousePos.y;
        
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        
        if (this.flyMode) {
            this.handleFlyMouseMove(deltaX, deltaY);
        } else {
            this.handleOrbitMouseMoveWithButton(deltaX, deltaY);
        }
        
        e.preventDefault();
    }
    
    onMouseUp(e) {
        if (this.isExternalControlled()) {
            e.stopPropagation();
            return;
        }
        
        // Only handle mouse up when Alt is pressed (or was pressed during drag)
        if (!e.altKey && this.isDragging) {
            // Alt was released during drag - stop camera movement
            this.isDragging = false;
            this.dragButton = -1;
            this.canvas.style.cursor = 'default';
            e.stopPropagation();
            return;
        }
        
        this.isDragging = false;
        this.dragButton = -1;
        this.canvas.style.cursor = 'default';
        e.preventDefault();
    }
    
    onWheel(e) {
        if (this.flyMode) {
            this.handleFlyWheel(e.deltaY);
        } else {
            this.handleOrbitWheel(e.deltaY);
        }
        e.preventDefault();
    }
    
    onKeyDown(e) {
        this.keys.add(e.code);
        
        // Handle special keys
        switch (e.code) {
            case 'KeyF':
                if (!e.repeat) {
                    this.toggleFlyMode();
                }
                break;
            case 'KeyR':
                if (!e.repeat) {
                    this.reset();
                }
                break;
        }
    }
    
    onKeyUp(e) {
        this.keys.delete(e.code);
    }
    
    getCursorForButton(button) {
        // Fusion 360-style cursor indicators
        switch (button) {
            case 0: return 'move'; // Shift+Left - Pan
            case 1: return 'grab'; // Middle - Orbit/Rotate
            case 2: return 'move'; // Right - Pan
            default: return 'default';
        }
    }
    
    handleOrbitMouseMove(deltaX, deltaY) {
        const sensitivity = this.config.mouseSensitivity;
        
        // Direct orbit control (used by Alt+drag)
        this.sphericalDelta.theta -= deltaX * sensitivity;
        this.sphericalDelta.phi -= deltaY * sensitivity;
    }
    
    handleOrbitMouseMoveWithButton(deltaX, deltaY) {
        const sensitivity = this.config.mouseSensitivity;
        
        // Fusion 360-style mouse controls
        switch (this.dragButton) {
            case 0: // Shift+Left - Pan
                this.panCamera(deltaX, deltaY);
                break;
                
            case 1: // Middle - Orbit/Rotate
                this.sphericalDelta.theta -= deltaX * sensitivity;
                this.sphericalDelta.phi -= deltaY * sensitivity;
                break;
                
            case 2: // Right - Pan (same as Shift+Left)
                this.panCamera(deltaX, deltaY);
                break;
        }
    }
    
    handleFlyMouseMove(deltaX, deltaY) {
        const sensitivity = this.config.mouseSensitivity * 0.5;
        
        this.euler.setFromQuaternion(this.camera.quaternion);
        this.euler.y -= deltaX * sensitivity;
        this.euler.x -= deltaY * sensitivity;
        
        // Clamp vertical rotation
        this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
        
        this.camera.quaternion.setFromEuler(this.euler);
    }
    
    panCamera(deltaX, deltaY) {
        const distance = this.camera.position.distanceTo(this.target);
        const fov = this.camera.fov * Math.PI / 180;
        const targetDistance = 2 * Math.tan(fov / 2) * distance;
        
        const panSpeed = targetDistance / this.canvas.clientHeight;
        
        const panLeft = new THREE.Vector3();
        const panUp = new THREE.Vector3();
        
        // Calculate pan vectors
        panLeft.setFromMatrixColumn(this.camera.matrix, 0);
        panUp.setFromMatrixColumn(this.camera.matrix, 1);
        
        panLeft.multiplyScalar(-deltaX * panSpeed);
        panUp.multiplyScalar(deltaY * panSpeed);
        
        const pan = new THREE.Vector3().addVectors(panLeft, panUp);
        this.target.add(pan);
    }
    
    handleOrbitWheel(deltaY) {
        const zoomSpeed = this.config.zoomSpeed;
        this.sphericalDelta.radius += deltaY * zoomSpeed;
    }
    
    handleFlyWheel(deltaY) {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        forward.multiplyScalar(-deltaY * this.config.zoomSpeed * 10);
        
        this.camera.position.add(forward);
    }
    
    toggleFlyMode() {
        this.flyMode = !this.flyMode;
        
        if (this.flyMode) {
            console.log('Fly mode enabled - WASD to move, mouse to look');
            // Initialize fly mode orientation
            this.euler.setFromQuaternion(this.camera.quaternion);
        } else {
            console.log('Orbit mode enabled - drag to orbit, right-click to pan');
            // Update spherical coordinates from current position
            this.updateSphericalFromCamera();
        }
    }
    
    reset() {
        // Reset to default position
        this.target.set(400, 0, 300);
        this.camera.position.set(400, 200, 400);
        this.camera.lookAt(this.target);
        
        this.updateSphericalFromCamera();
        this.flyMode = false;
        
        console.log('Camera reset to default position');
    }
    
    setDistance(distance) {
        if (!this.flyMode) {
            this.spherical.radius = Math.max(
                this.config.minDistance,
                Math.min(this.config.maxDistance, distance)
            );
        }
    }
    
    update() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = currentTime;
        
        if (this.flyMode) {
            this.updateFlyMode(deltaTime);
        } else {
            this.updateOrbitMode(deltaTime);
        }
    }
    
    updateFlyMode(deltaTime) {
        const speed = this.config.keyboardSpeed * deltaTime;
        const direction = new THREE.Vector3();
        
        // Calculate movement direction
        if (this.keys.has('KeyW')) direction.z -= 1;
        if (this.keys.has('KeyS')) direction.z += 1;
        if (this.keys.has('KeyA')) direction.x -= 1;
        if (this.keys.has('KeyD')) direction.x += 1;
        if (this.keys.has('KeyQ')) direction.y -= 1;
        if (this.keys.has('KeyE')) direction.y += 1;
        
        // Apply camera rotation to movement
        if (direction.length() > 0) {
            direction.normalize();
            direction.multiplyScalar(speed);
            
            // Transform by camera rotation (except Y for Q/E)
            const forward = new THREE.Vector3(0, 0, -direction.z);
            const right = new THREE.Vector3(direction.x, 0, 0);
            const up = new THREE.Vector3(0, direction.y, 0);
            
            forward.applyQuaternion(this.camera.quaternion);
            right.applyQuaternion(this.camera.quaternion);
            
            const movement = new THREE.Vector3()
                .add(forward)
                .add(right)
                .add(up);
            
            this.camera.position.add(movement);
        }
        
        // Enforce minimum altitude
        if (this.camera.position.y < this.config.minAltitude) {
            this.camera.position.y = this.config.minAltitude;
        }
    }
    
    updateOrbitMode(deltaTime) {
        // Handle keyboard movement in orbit mode
        if (this.keys.size > 0) {
            const speed = this.config.keyboardSpeed * deltaTime;
            const panVector = new THREE.Vector3();
            
            if (this.keys.has('KeyW')) panVector.z -= speed;
            if (this.keys.has('KeyS')) panVector.z += speed;
            if (this.keys.has('KeyA')) panVector.x -= speed;
            if (this.keys.has('KeyD')) panVector.x += speed;
            if (this.keys.has('KeyQ')) this.target.y -= speed;
            if (this.keys.has('KeyE')) this.target.y += speed;
            
            // Transform pan vector by camera orientation
            if (panVector.length() > 0) {
                const cameraDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDirection);
                
                const right = new THREE.Vector3();
                right.crossVectors(cameraDirection, this.camera.up).normalize();
                
                const forward = new THREE.Vector3();
                forward.crossVectors(this.camera.up, right).normalize();
                
                const worldPan = new THREE.Vector3()
                    .addScaledVector(right, panVector.x)
                    .addScaledVector(forward, panVector.z);
                
                this.target.add(worldPan);
            }
        }
        
        // Apply spherical deltas
        this.spherical.theta += this.sphericalDelta.theta;
        this.spherical.phi += this.sphericalDelta.phi;
        this.spherical.radius += this.sphericalDelta.radius;
        
        // Apply constraints
        this.spherical.phi = Math.max(
            this.config.minPolarAngle,
            Math.min(this.config.maxPolarAngle, this.spherical.phi)
        );
        
        this.spherical.radius = Math.max(
            this.config.minDistance,
            Math.min(this.config.maxDistance, this.spherical.radius)
        );
        
        // Constrain target Y to minimum altitude
        this.target.y = Math.max(this.config.minAltitude, this.target.y);
        
        // Update camera position
        const offset = new THREE.Vector3();
        offset.setFromSpherical(this.spherical);
        this.camera.position.copy(this.target).add(offset);
        
        // Look at target
        this.camera.lookAt(this.target);
        
        // Reset deltas
        this.sphericalDelta.set(0, 0, 0);
    }
    
    // Control methods for external event handling
    setExternalControl(enabled) {
        this.externalControl = enabled;
    }
    
    isExternalControlled() {
        return this.externalControl || false;
    }
    
    // Public API methods
    setTarget(x, y, z) {
        this.target.set(x, y, z);
        if (!this.flyMode) {
            this.updateSphericalFromCamera();
        }
    }
    
    focusOnEntity(entity) {
        if (entity && entity.position) {
            this.setTarget(entity.position.x, entity.position.y || 0, entity.position.y);
        }
    }
    
    getDistance() {
        if (this.flyMode) {
            return this.camera.position.distanceTo(this.target);
        }
        return this.spherical.radius;
    }
    
    saveState() {
        return {
            target: this.target.clone(),
            spherical: this.spherical.clone(),
            flyMode: this.flyMode,
            position: this.camera.position.clone(),
            quaternion: this.camera.quaternion.clone()
        };
    }
    
    loadState(state) {
        if (state.target) this.target.copy(state.target);
        if (state.spherical) this.spherical.copy(state.spherical);
        if (state.flyMode !== undefined) this.flyMode = state.flyMode;
        if (state.position) this.camera.position.copy(state.position);
        if (state.quaternion) this.camera.quaternion.copy(state.quaternion);
        
        if (!this.flyMode) {
            this.camera.lookAt(this.target);
        }
    }
    
    dispose() {
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('wheel', this.onWheel);
        
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        
        this.canvas.removeEventListener('contextmenu', () => {});
    }
}

// Export for global access
window.CameraController3D = CameraController3D;
/**
 * Mode Manager - Handles switching between 2D and 3D rendering modes
 */

class ModeManager {
    constructor() {
        this.currentMode = '2d'; // Default to 2D
        this.is3DSupported = false;
        this.renderer2D = null;
        this.renderer3D = null;
        
        // State preservation
        this.cameraState = null;
        this.uiState = {
            zoom: 1.0,
            entityScale: 1.0,
            showDetectionRanges: false,
            showPatrolRoutes: true,
            showTerrain: true
        };
        
        this.init();
    }
    
    async init() {
        // Check 3D support
        this.is3DSupported = this.checkWebGLSupport();
        
        // Load saved mode preference
        this.loadModePreference();
        
        // Initialize UI controls
        this.setupModeToggle();
        
        // Apply initial mode
        await this.applyMode(this.currentMode);
        
        console.log(`Mode manager initialized - Current mode: ${this.currentMode}, 3D supported: ${this.is3DSupported}`);
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
    
    loadModePreference() {
        const saved = localStorage.getItem('llmswarm_render_mode');
        if (saved && (saved === '2d' || (saved === '3d' && this.is3DSupported))) {
            this.currentMode = saved;
        } else {
            this.currentMode = '2d'; // Safe default
        }
    }
    
    saveModePreference() {
        localStorage.setItem('llmswarm_render_mode', this.currentMode);
    }
    
    setupModeToggle() {
        // Find the canvas controls section
        const canvasControls = document.querySelector('.canvas-controls');
        if (!canvasControls) {
            console.error('Canvas controls section not found');
            return;
        }
        
        // Check if mode toggle already exists to prevent duplicates
        const existingModeGroup = document.querySelector('.mode-toggle-group');
        if (existingModeGroup) {
            console.log('Mode toggle already exists, updating existing buttons');
            this.updateExistingModeButtons();
            return;
        }
        
        // Create mode toggle control group
        const modeGroup = document.createElement('div');
        modeGroup.className = 'control-group mode-toggle-group';
        modeGroup.innerHTML = `
            <label class="control-label">View:</label>
            <div class="mode-toggle">
                <button id="mode-2d-btn" class="mode-btn ${this.currentMode === '2d' ? 'active' : ''}">2D</button>
                <button id="mode-3d-btn" class="mode-btn ${this.currentMode === '3d' ? 'active' : ''}" 
                        ${!this.is3DSupported ? 'disabled title="WebGL not supported"' : ''}>3D</button>
            </div>
        `;
        
        // Insert at the beginning of canvas controls
        canvasControls.insertBefore(modeGroup, canvasControls.firstChild);
        
        // Add event listeners
        document.getElementById('mode-2d-btn').addEventListener('click', () => {
            this.switchMode('2d');
        });
        
        document.getElementById('mode-3d-btn').addEventListener('click', () => {
            if (this.is3DSupported) {
                this.switchMode('3d');
            }
        });
        
        
        // Add CSS for mode toggle
        this.addModeToggleCSS();
        
        // Update camera distance slider label for 3D
        this.updateCameraControlsForMode();
    }
    
    updateExistingModeButtons() {
        // Update existing buttons if they exist
        const btn2D = document.getElementById('mode-2d-btn');
        const btn3D = document.getElementById('mode-3d-btn');
        
        if (btn2D && btn3D) {
            // Update active states
            btn2D.classList.toggle('active', this.currentMode === '2d');
            btn3D.classList.toggle('active', this.currentMode === '3d');
            
            // Update 3D button state
            if (!this.is3DSupported) {
                btn3D.disabled = true;
                btn3D.title = 'WebGL not supported';
            } else {
                btn3D.disabled = false;
                btn3D.removeAttribute('title');
            }
            
            // Add event listeners if they don't exist
            if (!btn2D.hasAttribute('data-listener-added')) {
                btn2D.addEventListener('click', () => this.switchMode('2d'));
                btn2D.setAttribute('data-listener-added', 'true');
            }
            
            if (!btn3D.hasAttribute('data-listener-added')) {
                btn3D.addEventListener('click', () => {
                    if (this.is3DSupported) this.switchMode('3d');
                });
                btn3D.setAttribute('data-listener-added', 'true');
            }
        }
    }
    
    addModeToggleCSS() {
        if (document.getElementById('mode-toggle-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'mode-toggle-styles';
        style.textContent = `
            .mode-toggle-group {
                margin-right: 20px;
            }
            
            .mode-toggle {
                display: flex;
                border: 1px solid var(--border);
                border-radius: 4px;
                overflow: hidden;
            }
            
            .mode-btn {
                background: var(--surface);
                color: var(--text);
                border: none;
                padding: 6px 12px;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 40px;
            }
            
            .mode-btn:not(:last-child) {
                border-right: 1px solid var(--border);
            }
            
            .mode-btn:hover:not(:disabled) {
                background: var(--surface-hover);
            }
            
            .mode-btn.active {
                background: var(--primary);
                color: white;
            }
            
            .mode-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .camera-distance-group {
                display: none;
            }
            
            .camera-distance-group.visible {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .help-btn {
                background: var(--surface);
                color: var(--text-secondary);
                border: 1px solid var(--border);
                border-radius: 50%;
                width: 24px;
                height: 24px;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                margin-left: 8px;
                display: none;
                transition: all 0.2s ease;
            }
            
            .help-btn.visible {
                display: inline-block;
            }
            
            .help-btn:hover {
                background: var(--surface-hover);
                color: var(--text);
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(style);
    }
    
    async switchMode(newMode) {
        if (newMode === this.currentMode) return;
        
        if (newMode === '3d' && !this.is3DSupported) {
            this.showMessage('3D mode requires WebGL support', 'error');
            return;
        }
        
        console.log(`Switching from ${this.currentMode} to ${newMode}`);
        
        try {
            // Save current state
            this.saveCurrentState();
            
            // Update mode
            this.currentMode = newMode;
            this.saveModePreference();
            
            // Apply new mode
            await this.applyMode(newMode);
            
            // Update UI
            this.updateModeButtons();
            this.updateCameraControlsForMode();
            
            this.showMessage(`Switched to ${newMode.toUpperCase()} mode`, 'success');
            
        } catch (error) {
            console.error('Error switching modes:', error);
            this.showMessage(`Failed to switch to ${newMode.toUpperCase()} mode: ${error.message}`, 'error');
            
            // Revert mode change
            this.currentMode = newMode === '2d' ? '3d' : '2d';
            this.updateModeButtons();
        }
    }
    
    saveCurrentState() {
        // Save UI state
        const zoomSlider = document.getElementById('zoom-slider');
        const entityScaleSlider = document.getElementById('entity-scale-slider');
        const detectionRangesCheck = document.getElementById('show-detection-ranges');
        const patrolRoutesCheck = document.getElementById('show-patrol-routes');
        const terrainCheck = document.getElementById('show-terrain');
        
        if (zoomSlider) this.uiState.zoom = parseFloat(zoomSlider.value);
        if (entityScaleSlider) this.uiState.entityScale = parseFloat(entityScaleSlider.value);
        if (detectionRangesCheck) this.uiState.showDetectionRanges = detectionRangesCheck.checked;
        if (patrolRoutesCheck) this.uiState.showPatrolRoutes = patrolRoutesCheck.checked;
        if (terrainCheck) this.uiState.showTerrain = terrainCheck.checked;
        
        // Save camera state
        if (this.currentMode === '3d' && this.renderer3D && this.renderer3D.cameraController) {
            this.cameraState = this.renderer3D.cameraController.saveState();
        }
    }
    
    async applyMode(mode) {
        if (mode === '2d') {
            await this.setup2DMode();
        } else if (mode === '3d') {
            await this.setup3DMode();
        }
        
        // Restore UI state
        this.restoreUIState();
    }
    
    async setup2DMode() {
        console.log('Setting up 2D mode...');
        
        try {
            // Properly dispose 3D renderer and release canvas
            if (this.renderer3D) {
                console.log('Disposing 3D renderer...');
                try {
                    this.renderer3D.dispose();
                } catch (error) {
                    console.warn('Error disposing 3D renderer:', error);
                }
                this.renderer3D = null;
                window.renderer3D = null;
            }
            
            // Create fresh canvas for 2D context
            console.log('Creating fresh canvas for 2D context...');
            const canvas = document.getElementById('simulation-canvas');
            if (canvas) {
                const parent = canvas.parentNode;
                const rect = canvas.getBoundingClientRect();
                
                // Store the computed styles
                const computedStyle = window.getComputedStyle(canvas);
                const className = canvas.className;
                
                console.log('Removing old canvas element...');
                parent.removeChild(canvas);
                
                // Wait for DOM update
                await new Promise(resolve => requestAnimationFrame(resolve));
                
                // Create completely fresh canvas element
                const newCanvas = document.createElement('canvas');
                newCanvas.id = 'simulation-canvas';
                newCanvas.className = className;
                
                // Apply critical styles manually
                newCanvas.style.width = computedStyle.width;
                newCanvas.style.height = computedStyle.height;
                newCanvas.style.display = computedStyle.display;
                newCanvas.style.position = computedStyle.position;
                
                // Set proper dimensions for high DPI
                const dpr = window.devicePixelRatio || 1;
                newCanvas.width = rect.width * dpr;
                newCanvas.height = rect.height * dpr;
                
                console.log('Inserting fresh canvas element...');
                parent.appendChild(newCanvas);
                
                // Additional DOM update delay
                await new Promise(resolve => requestAnimationFrame(resolve));
                
                console.log('Fresh canvas created for 2D context');
            }
            
            // Wait a frame to ensure canvas is properly attached to DOM
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Initialize 2D renderer with fresh canvas
            console.log('Creating 2D renderer...');
            this.renderer2D = new CanvasRenderer('simulation-canvas');
            window.renderer = this.renderer2D;
            
            // Update entities if available
            if (window.app && window.app.lastSimulationState) {
                this.renderer2D.updateEntities(
                    window.app.lastSimulationState.entities || [],
                    window.app.lastSimulationState.selected_entities || []
                );
            }
            
            console.log('2D mode setup complete');
        } catch (error) {
            console.error('Error setting up 2D mode:', error);
            throw error;
        }
    }
    
    async setup3DMode() {
        console.log('Setting up 3D mode...');
        
        try {
            // Check if Renderer3D class is available
            if (typeof Renderer3D === 'undefined') {
                throw new Error('Renderer3D class not found - script may not have loaded');
            }
            
            // Dispose 2D renderer if active
            if (this.renderer2D) {
                console.log('Cleaning up 2D renderer...');
                this.renderer2D = null;
                window.renderer = null;
            }
            
            // Critical: Create fresh canvas for WebGL context
            console.log('Creating fresh canvas for WebGL context...');
            const canvas = document.getElementById('simulation-canvas');
            if (canvas) {
                const parent = canvas.parentNode;
                const rect = canvas.getBoundingClientRect();
                
                // Store the computed styles, not the cssText which might be incomplete
                const computedStyle = window.getComputedStyle(canvas);
                const className = canvas.className;
                
                console.log('Removing old canvas element...');
                parent.removeChild(canvas);
                
                // Wait for DOM update
                await new Promise(resolve => requestAnimationFrame(resolve));
                
                // Create completely fresh canvas element
                const newCanvas = document.createElement('canvas');
                newCanvas.id = 'simulation-canvas';
                newCanvas.className = className;
                
                // Apply critical styles manually
                newCanvas.style.width = computedStyle.width;
                newCanvas.style.height = computedStyle.height;
                newCanvas.style.display = computedStyle.display;
                newCanvas.style.position = computedStyle.position;
                
                // Set proper dimensions
                newCanvas.width = rect.width;
                newCanvas.height = rect.height;
                
                console.log('Inserting fresh canvas element...');
                parent.appendChild(newCanvas);
                
                // Additional DOM update delay
                await new Promise(resolve => requestAnimationFrame(resolve));
                
                console.log('Fresh canvas created for WebGL context');
            }
            
            // Always recreate 3D renderer to ensure fresh canvas connection
            if (this.renderer3D) {
                console.log('Disposing existing 3D renderer...');
                try {
                    this.renderer3D.dispose();
                } catch (error) {
                    console.warn('Error disposing existing 3D renderer:', error);
                }
                this.renderer3D = null;
            }
            
            // Wait a frame to ensure canvas is properly attached to DOM
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            console.log('Creating new Renderer3D instance...');
            this.renderer3D = new Renderer3D('simulation-canvas');
            
            console.log('Calling renderer3D.init()...');
            const success = await this.renderer3D.init();
            
            if (!success) {
                throw new Error('3D renderer initialization returned false');
            }
            
            // Set active renderer
            window.renderer3D = this.renderer3D;
            window.renderer = this.renderer3D; // For compatibility
            
            // Restore camera state if available
            if (this.cameraState && this.renderer3D.cameraController) {
                this.renderer3D.cameraController.loadState(this.cameraState);
            }
            
            // Update entities if available
            if (window.app && window.app.lastSimulationState) {
                this.renderer3D.updateEntities(
                    window.app.lastSimulationState.entities || [],
                    window.app.lastSimulationState.selected_entities || []
                );
            }
            
            console.log('3D mode setup complete');
        } catch (error) {
            console.error('Error setting up 3D mode:', error);
            this.currentMode = '2d';
            await this.setup2DMode();
            throw error;
        }
    }
    
    restoreUIState() {
        // Restore UI controls
        const zoomSlider = document.getElementById('zoom-slider');
        const entityScaleSlider = document.getElementById('entity-scale-slider');
        const detectionRangesCheck = document.getElementById('show-detection-ranges');
        const patrolRoutesCheck = document.getElementById('show-patrol-routes');
        const terrainCheck = document.getElementById('show-terrain');
        
        if (this.currentMode === '2d') {
            // 2D mode - zoom affects viewport
            if (zoomSlider) {
                zoomSlider.value = this.uiState.zoom;
                if (this.renderer2D) this.renderer2D.setZoom(this.uiState.zoom);
            }
        } else {
            // 3D mode - zoom affects camera distance
            if (zoomSlider && this.renderer3D) {
                const distance = this.mapZoomToCameraDistance(this.uiState.zoom);
                this.renderer3D.setCameraDistance(distance);
                zoomSlider.value = this.uiState.zoom;
            }
        }
        
        if (entityScaleSlider) {
            entityScaleSlider.value = this.uiState.entityScale;
            const activeRenderer = this.currentMode === '3d' ? this.renderer3D : this.renderer2D;
            if (activeRenderer && typeof activeRenderer.setEntityScale === 'function') {
                try {
                    activeRenderer.setEntityScale(this.uiState.entityScale);
                } catch (error) {
                    console.warn('Error setting entity scale:', error);
                }
            }
        }
        
        if (detectionRangesCheck) {
            detectionRangesCheck.checked = this.uiState.showDetectionRanges;
            const activeRenderer = this.currentMode === '3d' ? this.renderer3D : this.renderer2D;
            if (activeRenderer && typeof activeRenderer.setShowDetectionRanges === 'function') {
                try {
                    activeRenderer.setShowDetectionRanges(this.uiState.showDetectionRanges);
                } catch (error) {
                    console.warn('Error setting detection ranges:', error);
                }
            }
        }
        
        if (patrolRoutesCheck) {
            patrolRoutesCheck.checked = this.uiState.showPatrolRoutes;
            const activeRenderer = this.currentMode === '3d' ? this.renderer3D : this.renderer2D;
            if (activeRenderer && typeof activeRenderer.setShowPatrolRoutes === 'function') {
                try {
                    activeRenderer.setShowPatrolRoutes(this.uiState.showPatrolRoutes);
                } catch (error) {
                    console.warn('Error setting patrol routes:', error);
                }
            }
        }
        
        if (terrainCheck) {
            terrainCheck.checked = this.uiState.showTerrain;
            const activeRenderer = this.currentMode === '3d' ? this.renderer3D : this.renderer2D;
            if (activeRenderer && typeof activeRenderer.setShowTerrain === 'function') {
                try {
                    activeRenderer.setShowTerrain(this.uiState.showTerrain);
                } catch (error) {
                    console.warn('Error setting terrain:', error);
                }
            }
        }
    }
    
    updateModeButtons() {
        const btn2D = document.getElementById('mode-2d-btn');
        const btn3D = document.getElementById('mode-3d-btn');
        
        if (btn2D && btn3D) {
            btn2D.classList.toggle('active', this.currentMode === '2d');
            btn3D.classList.toggle('active', this.currentMode === '3d');
        }
    }
    
    updateCameraControlsForMode() {
        const zoomLabel = document.querySelector('label[for="zoom-slider"]');
        const zoomDisplay = document.getElementById('zoom-display');
        
        if (this.currentMode === '3d') {
            if (zoomLabel) zoomLabel.textContent = 'Camera:';
            if (zoomDisplay) {
                const slider = document.getElementById('zoom-slider');
                const distance = slider ? this.mapZoomToCameraDistance(parseFloat(slider.value)) : 200;
                zoomDisplay.textContent = `${Math.round(distance)}m`;
            }
        } else {
            if (zoomLabel) zoomLabel.textContent = 'Zoom:';
            if (zoomDisplay) {
                const slider = document.getElementById('zoom-slider');
                const zoom = slider ? parseFloat(slider.value) : 1.0;
                zoomDisplay.textContent = `${Math.round(zoom * 100)}%`;
            }
        }
    }
    
    mapZoomToCameraDistance(zoom) {
        // Map zoom slider (0.5-3.0) to camera distance (1000-50)
        const minDistance = 50;
        const maxDistance = 1000;
        const normalizedZoom = (zoom - 0.5) / (3.0 - 0.5); // 0-1
        return maxDistance - (normalizedZoom * (maxDistance - minDistance));
    }
    
    mapCameraDistanceToZoom(distance) {
        // Reverse mapping
        const minDistance = 50;
        const maxDistance = 1000;
        const normalizedDistance = (maxDistance - distance) / (maxDistance - minDistance);
        return 0.5 + (normalizedDistance * (3.0 - 0.5));
    }
    
    // Public API
    getCurrentMode() {
        return this.currentMode;
    }
    
    is3DModeActive() {
        return this.currentMode === '3d';
    }
    
    getActiveRenderer() {
        return this.currentMode === '3d' ? this.renderer3D : this.renderer2D;
    }
    
    // Handle slider changes
    handleZoomChange(value) {
        this.uiState.zoom = value;
        
        if (this.currentMode === '2d' && this.renderer2D) {
            this.renderer2D.setZoom(value);
        } else if (this.currentMode === '3d' && this.renderer3D) {
            const distance = this.mapZoomToCameraDistance(value);
            this.renderer3D.setCameraDistance(distance);
        }
        
        this.updateCameraControlsForMode();
    }
    
    handleEntityScaleChange(value) {
        this.uiState.entityScale = value;
        const activeRenderer = this.getActiveRenderer();
        if (activeRenderer) {
            activeRenderer.setEntityScale(value);
        }
    }
    
    handleDetectionRangesToggle(checked) {
        this.uiState.showDetectionRanges = checked;
        const activeRenderer = this.getActiveRenderer();
        if (activeRenderer) {
            activeRenderer.setShowDetectionRanges(checked);
        }
    }
    
    handlePatrolRoutesToggle(checked) {
        this.uiState.showPatrolRoutes = checked;
        const activeRenderer = this.getActiveRenderer();
        if (activeRenderer) {
            activeRenderer.setShowPatrolRoutes(checked);
        }
    }
    
    handleTerrainToggle(checked) {
        this.uiState.showTerrain = checked;
        const activeRenderer = this.getActiveRenderer();
        if (activeRenderer) {
            activeRenderer.setShowTerrain(checked);
        }
    }
    
    showMessage(text, type = 'info') {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.className = `mode-notification ${type}`;
        notification.textContent = text;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#0ea5e9'};
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });
        
        // Remove after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // Reset method for simulation resets
    reset() {
        console.log('Resetting mode manager...');
        
        try {
            // Reset active renderer
            const activeRenderer = this.getActiveRenderer();
            if (activeRenderer && typeof activeRenderer.reset === 'function') {
                activeRenderer.reset();
            }
            
            // Clear simulation state
            this.lastSimulationState = null;
            
            console.log('Mode manager reset complete');
        } catch (error) {
            console.error('Error during mode manager reset:', error);
        }
    }
    
    dispose() {
        console.log('Disposing mode manager...');
        
        try {
            if (this.renderer2D) {
                // 2D renderer cleanup handled elsewhere
            }
            
            if (this.renderer3D) {
                this.renderer3D.dispose();
                this.renderer3D = null;
            }
            
            console.log('Mode manager disposed');
        } catch (error) {
            console.error('Error during mode manager disposal:', error);
        }
    }
}

// Export for global access
window.ModeManager = ModeManager;
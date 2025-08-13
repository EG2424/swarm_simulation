/**
 * Main Application - Initializes and coordinates all components
 */

class LLMSwarmApp {
    constructor() {
        this.isInitialized = false;
        this.animationFrameId = null;
        this.lastRenderTime = 0;
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        
        this.init();
    }

    async init() {
        console.log('Initializing LLM Swarm Application...');
        
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
            }
            
            // Initialize core components
            this.initializeComponents();
            
            // Start WebSocket connection
            await this.connectWebSocket();
            
            // Start rendering loop
            this.startRenderLoop();
            
            // Load initial scenarios
            await this.loadScenarios();
            
            this.isInitialized = true;
            console.log('Application initialized successfully');
            
            // Show welcome message
            if (window.chatSystem) {
                window.chatSystem.addSystemMessage('Welcome to LLM Swarm! Click Start to begin simulation.');
            }
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showErrorMessage('Failed to initialize application. Please refresh the page.');
        }
    }

    initializeComponents() {
        console.log('Initializing components...');
        
        // Initialize renderer
        window.renderer = new CanvasRenderer('simulation-canvas');
        console.log('✓ Canvas renderer initialized');
        
        // Initialize UI controls
        window.uiControls = new UIControls();
        console.log('✓ UI controls initialized');
        
        // Initialize entity controls
        window.entityControls = new EntityControls();
        console.log('✓ Entity controls initialized');
        
        // Initialize chat system
        window.chatSystem = new ChatSystem();
        console.log('✓ Chat system initialized');
        
        // Setup global error handling
        this.setupErrorHandling();
        console.log('✓ Error handling setup');
        
        // Setup performance monitoring
        this.setupPerformanceMonitoring();
        console.log('✓ Performance monitoring setup');
    }

    async connectWebSocket() {
        console.log('Connecting to WebSocket...');
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 10000);
            
            const handleConnection = () => {
                clearTimeout(timeout);
                window.removeEventListener('ws-connected', handleConnection);
                console.log('✓ WebSocket connected');
                resolve();
            };
            
            const handleError = (event) => {
                clearTimeout(timeout);
                window.removeEventListener('ws-error', handleError);
                console.error('WebSocket connection failed:', event.detail);
                reject(new Error('WebSocket connection failed'));
            };
            
            window.addEventListener('ws-connected', handleConnection);
            window.addEventListener('ws-error', handleError);
            
            // Start connection
            window.wsManager.connect();
        });
    }

    startRenderLoop() {
        console.log('Starting render loop...');
        
        const render = (currentTime) => {
            if (currentTime - this.lastRenderTime >= this.frameInterval) {
                if (window.renderer) {
                    window.renderer.render();
                }
                this.lastRenderTime = currentTime;
            }
            
            this.animationFrameId = requestAnimationFrame(render);
        };
        
        this.animationFrameId = requestAnimationFrame(render);
        console.log('✓ Render loop started');
    }

    async loadScenarios() {
        console.log('Loading available scenarios...');
        
        try {
            const response = await fetch('/api/scenarios');
            if (response.ok) {
                const data = await response.json();
                this.populateScenarioSelector(data.scenarios);
                console.log(`✓ Loaded ${data.scenarios.length} scenarios`);
            } else {
                console.warn('Failed to load scenarios');
            }
        } catch (error) {
            console.warn('Error loading scenarios:', error);
        }
    }

    populateScenarioSelector(scenarios) {
        const select = document.getElementById('scenario-select');
        if (!select) return;
        
        // Clear existing options (except the first one)
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Add scenario options
        for (const scenario of scenarios) {
            const option = document.createElement('option');
            option.value = scenario.name;
            option.textContent = scenario.title || scenario.name;
            option.title = scenario.description || '';
            select.appendChild(option);
        }
    }

    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleError(event.error);
        });
        
        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason);
        });
        
        // WebSocket error handler
        window.addEventListener('ws-error', (event) => {
            console.error('WebSocket error:', event.detail);
            this.showErrorMessage('Connection error. Attempting to reconnect...');
        });
        
        window.addEventListener('ws-disconnected', () => {
            this.showErrorMessage('Connection lost. Attempting to reconnect...');
        });
        
        window.addEventListener('ws-connected', () => {
            this.hideErrorMessage();
        });
    }

    setupPerformanceMonitoring() {
        let frameCount = 0;
        let lastFPSUpdate = Date.now();
        
        const updateFPS = () => {
            frameCount++;
            const now = Date.now();
            
            if (now - lastFPSUpdate >= 1000) {
                const fps = Math.round(frameCount * 1000 / (now - lastFPSUpdate));
                
                // Update FPS counter in UI
                const fpsCounter = document.getElementById('fps-counter');
                if (fpsCounter) {
                    fpsCounter.textContent = `FPS: ${fps}`;
                }
                
                // Log performance warnings
                if (fps < 30) {
                    console.warn(`Low FPS detected: ${fps}`);
                }
                
                frameCount = 0;
                lastFPSUpdate = now;
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        requestAnimationFrame(updateFPS);
    }

    handleError(error) {
        console.error('Application error:', error);
        
        // Show user-friendly error message
        this.showErrorMessage('An error occurred. Please check the console for details.');
        
        // Optionally send error to logging service
        if (this.shouldReportError(error)) {
            this.reportError(error);
        }
    }

    shouldReportError(error) {
        // Filter out non-critical errors
        const ignoredErrors = [
            'ResizeObserver loop limit exceeded',
            'Non-Error promise rejection captured'
        ];
        
        return !ignoredErrors.some(ignored => 
            error.message && error.message.includes(ignored)
        );
    }

    reportError(error) {
        // TODO: Implement error reporting to analytics service
        console.log('Would report error:', error);
    }

    showErrorMessage(message) {
        // Create or update error notification
        let errorDiv = document.getElementById('error-notification');
        
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'error-notification';
            errorDiv.className = 'error-notification';
            document.body.appendChild(errorDiv);
        }
        
        errorDiv.textContent = message;
        errorDiv.classList.add('visible');
        
        // Add CSS if not present
        if (!document.getElementById('error-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'error-notification-styles';
            style.textContent = `
                .error-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--danger);
                    color: white;
                    padding: 12px 16px;
                    border-radius: 6px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 10000;
                    opacity: 0;
                    transform: translateX(100%);
                    transition: all 0.3s ease;
                }
                
                .error-notification.visible {
                    opacity: 1;
                    transform: translateX(0);
                }
            `;
            document.head.appendChild(style);
        }
    }

    hideErrorMessage() {
        const errorDiv = document.getElementById('error-notification');
        if (errorDiv) {
            errorDiv.classList.remove('visible');
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 300);
        }
    }

    // Utility methods
    getApplicationState() {
        return {
            initialized: this.isInitialized,
            websocketConnected: window.wsManager?.isConnected || false,
            renderingActive: this.animationFrameId !== null,
            components: {
                renderer: !!window.renderer,
                uiControls: !!window.uiControls,
                entityControls: !!window.entityControls,
                chatSystem: !!window.chatSystem
            }
        };
    }

    // Cleanup method
    destroy() {
        console.log('Shutting down application...');
        
        // Stop render loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Disconnect WebSocket
        if (window.wsManager) {
            window.wsManager.disconnect();
        }
        
        // Clean up components
        window.renderer = null;
        window.uiControls = null;
        window.entityControls = null;
        window.chatSystem = null;
        
        this.isInitialized = false;
        console.log('Application shutdown complete');
    }

    // Development/debug methods
    debugInfo() {
        return {
            state: this.getApplicationState(),
            performance: {
                targetFPS: this.targetFPS,
                frameInterval: this.frameInterval
            },
            websocket: {
                connected: window.wsManager?.isConnected,
                reconnectAttempts: window.wsManager?.reconnectAttempts
            },
            renderer: window.renderer ? {
                zoom: window.renderer.viewport.zoom,
                entityCount: window.renderer.entities.length,
                selectedCount: window.renderer.selectedEntityIds.length
            } : null
        };
    }
}

// Initialize application when page loads
let app = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new LLMSwarmApp();
    });
} else {
    app = new LLMSwarmApp();
}

// Make app globally available for debugging
window.app = app;

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (app) {
        app.destroy();
    }
});
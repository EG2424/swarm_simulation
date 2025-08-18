/**
 * Help Overlay - Shows keyboard and mouse controls for 3D mode
 */

class HelpOverlay {
    constructor() {
        this.isVisible = false;
        this.overlay = null;
        this.createOverlay();
        this.setupEventListeners();
    }
    
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'help-overlay';
        this.overlay.className = 'help-overlay hidden';
        
        this.overlay.innerHTML = `
            <div class="help-content">
                <div class="help-header">
                    <h3>3D Controls</h3>
                    <button class="help-close" aria-label="Close help">&times;</button>
                </div>
                
                <div class="help-sections">
                    <div class="help-section">
                        <h4>Camera Controls</h4>
                        <div class="help-controls">
                            <div class="help-item">
                                <kbd>Left Mouse</kbd>
                                <span>Orbit around target</span>
                            </div>
                            <div class="help-item">
                                <kbd>Right Mouse</kbd>
                                <span>Pan camera</span>
                            </div>
                            <div class="help-item">
                                <kbd>Mouse Wheel</kbd>
                                <span>Zoom in/out</span>
                            </div>
                            <div class="help-item">
                                <kbd>Middle Mouse</kbd>
                                <span>Tilt camera</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="help-section">
                        <h4>Keyboard Controls</h4>
                        <div class="help-controls">
                            <div class="help-item">
                                <kbd>W A S D</kbd>
                                <span>Move camera/target</span>
                            </div>
                            <div class="help-item">
                                <kbd>Q / E</kbd>
                                <span>Move up/down</span>
                            </div>
                            <div class="help-item">
                                <kbd>R</kbd>
                                <span>Reset camera position</span>
                            </div>
                            <div class="help-item">
                                <kbd>F</kbd>
                                <span>Toggle fly mode</span>
                            </div>
                            <div class="help-item">
                                <kbd>H</kbd>
                                <span>Toggle this help</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="help-section">
                        <h4>Selection & Commands</h4>
                        <div class="help-controls">
                            <div class="help-item">
                                <kbd>Left Click</kbd>
                                <span>Select entity</span>
                            </div>
                            <div class="help-item">
                                <kbd>Shift + Click</kbd>
                                <span>Multi-select entities</span>
                            </div>
                            <div class="help-item">
                                <kbd>Right Click</kbd>
                                <span>Move selected entities</span>
                            </div>
                            <div class="help-item">
                                <kbd>Ctrl + Right Click</kbd>
                                <span>Append to patrol route</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="help-section">
                        <h4>Fly Mode (Press F)</h4>
                        <div class="help-controls">
                            <div class="help-item">
                                <kbd>W A S D</kbd>
                                <span>Move forward/back/left/right</span>
                            </div>
                            <div class="help-item">
                                <kbd>Q / E</kbd>
                                <span>Move down/up</span>
                            </div>
                            <div class="help-item">
                                <kbd>Mouse</kbd>
                                <span>Look around (FPS style)</span>
                            </div>
                            <div class="help-item">
                                <kbd>Mouse Wheel</kbd>
                                <span>Move forward/back</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="help-footer">
                    <p>Press <kbd>H</kbd> anytime to toggle this help overlay</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.overlay);
        this.addHelpStyles();
    }
    
    addHelpStyles() {
        if (document.getElementById('help-overlay-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'help-overlay-styles';
        style.textContent = `
            .help-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
                backdrop-filter: blur(4px);
            }
            
            .help-overlay.visible {
                opacity: 1;
            }
            
            .help-overlay.hidden {
                opacity: 0;
                pointer-events: none;
            }
            
            .help-content {
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: 8px;
                max-width: 800px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                transform: scale(0.9);
                transition: transform 0.3s ease;
            }
            
            .help-overlay.visible .help-content {
                transform: scale(1);
            }
            
            .help-header {
                display: flex;
                justify-content: between;
                align-items: center;
                padding: 20px 24px 16px;
                border-bottom: 1px solid var(--border);
            }
            
            .help-header h3 {
                margin: 0;
                color: var(--text);
                font-size: 20px;
                flex: 1;
            }
            
            .help-close {
                background: none;
                border: none;
                color: var(--text-secondary);
                font-size: 24px;
                cursor: pointer;
                padding: 4px;
                margin: -4px;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            
            .help-close:hover {
                background: var(--surface-hover);
                color: var(--text);
            }
            
            .help-sections {
                padding: 20px 24px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
            }
            
            @media (max-width: 768px) {
                .help-sections {
                    grid-template-columns: 1fr;
                    gap: 20px;
                }
            }
            
            .help-section h4 {
                margin: 0 0 12px 0;
                color: var(--text);
                font-size: 14px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .help-controls {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .help-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 6px 0;
            }
            
            .help-item kbd {
                background: var(--surface-hover);
                border: 1px solid var(--border);
                border-radius: 4px;
                padding: 4px 8px;
                font-family: inherit;
                font-size: 11px;
                font-weight: 500;
                color: var(--text);
                min-width: 80px;
                text-align: center;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            }
            
            .help-item span {
                color: var(--text-secondary);
                font-size: 13px;
                flex: 1;
            }
            
            .help-footer {
                padding: 16px 24px 20px;
                border-top: 1px solid var(--border);
                text-align: center;
            }
            
            .help-footer p {
                margin: 0;
                color: var(--text-secondary);
                font-size: 12px;
            }
            
            .help-footer kbd {
                background: var(--surface-hover);
                border: 1px solid var(--border);
                border-radius: 3px;
                padding: 2px 6px;
                font-family: inherit;
                font-size: 11px;
                color: var(--text);
            }
        `;
        document.head.appendChild(style);
    }
    
    setupEventListeners() {
        // Close button
        this.overlay.querySelector('.help-close').addEventListener('click', () => {
            this.hide();
        });
        
        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.isVisible) {
                this.hide();
                e.preventDefault();
            }
        });
    }
    
    show() {
        this.isVisible = true;
        this.overlay.classList.remove('hidden');
        setTimeout(() => {
            this.overlay.classList.add('visible');
        }, 10);
        
        // Focus management
        this.overlay.querySelector('.help-close').focus();
    }
    
    hide() {
        this.isVisible = false;
        this.overlay.classList.remove('visible');
        setTimeout(() => {
            this.overlay.classList.add('hidden');
        }, 300);
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}

// Global help overlay instance
window.helpOverlay = null;

// Initialize help overlay when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.helpOverlay = new HelpOverlay();
    });
} else {
    window.helpOverlay = new HelpOverlay();
}
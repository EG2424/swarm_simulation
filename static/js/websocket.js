/**
 * WebSocket Communication Layer
 * Handles real-time communication with simulation backend
 */

class WebSocketManager {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000; // Start with 1 second
        this.messageHandlers = new Map();
        this.messageQueue = [];
        this.pingInterval = null;
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        
        try {
            this.ws = new WebSocket(wsUrl);
            this.setupEventHandlers();
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.scheduleReconnect();
        }
    }

    setupEventHandlers() {
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            
            // Send queued messages
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                this.send(message);
            }
            
            // Start ping to keep connection alive
            this.startPing();
            
            // Notify listeners
            this.emit('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error, event.data);
            }
        };

        this.ws.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);
            this.isConnected = false;
            this.stopPing();
            
            if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            }
            
            this.emit('disconnected');
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emit('error', error);
        };
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, delay);
    }

    send(message) {
        if (!this.isConnected || this.ws.readyState !== WebSocket.OPEN) {
            // Queue message for later
            this.messageQueue.push(message);
            return false;
        }

        try {
            this.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Error sending WebSocket message:', error);
            return false;
        }
    }

    handleMessage(message) {
        const { type, data } = message;
        
        // Handle system messages
        if (type === 'pong') {
            // Ping response received
            return;
        }
        
        // Forward to registered handlers
        const handlers = this.messageHandlers.get(type) || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`Error in message handler for ${type}:`, error);
            }
        });
        
        // Emit generic message event
        this.emit('message', { type, data });
    }

    on(messageType, handler) {
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, []);
        }
        this.messageHandlers.get(messageType).push(handler);
    }

    off(messageType, handler) {
        if (this.messageHandlers.has(messageType)) {
            const handlers = this.messageHandlers.get(messageType);
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(eventType, data) {
        // Dispatch custom events
        window.dispatchEvent(new CustomEvent(`ws-${eventType}`, { detail: data }));
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.send({
                    type: 'ping',
                    data: { timestamp: Date.now() }
                });
            }
        }, 30000); // Ping every 30 seconds
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    disconnect() {
        this.stopPing();
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
        }
        this.isConnected = false;
    }

    // API Methods for simulation control
    getState() {
        return this.send({
            type: 'get_state',
            data: {}
        });
    }

    controlSimulation(action, speedMultiplier = null) {
        return this.send({
            type: 'control_simulation',
            data: {
                action,
                speed_multiplier: speedMultiplier
            }
        });
    }

    spawnEntity(type, position, heading = 0, mode = null) {
        return this.send({
            type: 'spawn_entity',
            data: {
                type,
                position,
                heading,
                mode
            }
        });
    }

    commandEntity(entityId, command) {
        return this.send({
            type: 'command_entity',
            data: {
                entity_id: entityId,
                command
            }
        });
    }

    removeEntity(entityId) {
        return this.send({
            type: 'remove_entity',
            data: {
                entity_id: entityId
            }
        });
    }

    selectEntity(entityId, selected = true, multiSelect = false) {
        return this.send({
            type: 'select_entity',
            data: {
                entity_id: entityId,
                selected,
                multi_select: multiSelect
            }
        });
    }

    sendChatMessage(sender, content, messageType = 'human') {
        return this.send({
            type: 'chat_message',
            data: {
                sender,
                content,
                message_type: messageType,
                timestamp: Date.now() / 1000
            }
        });
    }
}

// Global WebSocket instance
window.wsManager = new WebSocketManager();
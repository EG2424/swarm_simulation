/**
 * Chat System - Handles chat messages and event logging
 */

class ChatSystem {
    constructor() {
        this.chatMessages = [];
        this.events = [];
        this.maxChatMessages = 100;
        this.maxEvents = 50;
        
        this.setupEventListeners();
        this.setupWebSocketHandlers();
    }

    setupEventListeners() {
        // Chat input
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-chat-btn');
        
        sendBtn.addEventListener('click', () => {
            this.sendChatMessage();
        });
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
        
        // Clear events button
        document.getElementById('clear-events-btn').addEventListener('click', () => {
            this.clearEvents();
        });
    }

    setupWebSocketHandlers() {
        // Chat message events
        window.wsManager.on('chat_message_added', (data) => {
            this.addChatMessage(data);
        });
        
        // Simulation events
        window.wsManager.on('simulation_update', (data) => {
            if (data.events) {
                this.updateEvents(data.events);
            }
            
            if (data.chat_messages) {
                this.updateChatMessages(data.chat_messages);
            }
        });
        
        // Entity events
        window.wsManager.on('entity_spawned', (data) => {
            this.addEvent({
                type: 'entity_spawned',
                timestamp: Date.now() / 1000,
                data: { entity_type: data.type, entity_id: data.id }
            });
        });
        
        window.wsManager.on('entity_removed', (data) => {
            this.addEvent({
                type: 'entity_removed',
                timestamp: Date.now() / 1000,
                data: { entity_id: data.entity_id }
            });
        });
        
        // Detection and kamikaze events
        window.wsManager.on('detection', (data) => {
            this.addEvent({
                type: 'detection',
                timestamp: Date.now() / 1000,
                data: data
            });
        });
        
        window.wsManager.on('kamikaze', (data) => {
            this.addEvent({
                type: 'kamikaze',
                timestamp: Date.now() / 1000,
                data: data
            });
            
            // Also add as chat message for visibility
            this.addChatMessage({
                sender: 'System',
                content: `🔥 Kamikaze! Drone ${data.drone_id.substring(0, 8)} engaged Tank ${data.tank_id.substring(0, 8)}`,
                timestamp: Date.now() / 1000,
                message_type: 'system'
            });
        });
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Send message via WebSocket
        window.wsManager.sendChatMessage('Human', message, 'human');
        
        // Clear input
        input.value = '';
    }

    addChatMessage(messageData) {
        this.chatMessages.push(messageData);
        
        // Limit number of stored messages
        if (this.chatMessages.length > this.maxChatMessages) {
            this.chatMessages = this.chatMessages.slice(-this.maxChatMessages);
        }
        
        this.updateChatDisplay();
    }

    updateChatMessages(messages) {
        this.chatMessages = messages || [];
        this.updateChatDisplay();
    }

    updateChatDisplay() {
        const chatContainer = document.getElementById('chat-messages');
        if (!chatContainer) return;
        
        // Store scroll position
        const wasAtBottom = chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 5;
        
        // Clear and rebuild
        chatContainer.innerHTML = '';
        
        for (const message of this.chatMessages) {
            const messageElement = this.createChatMessageElement(message);
            chatContainer.appendChild(messageElement);
        }
        
        // Auto-scroll to bottom if user was at bottom
        if (wasAtBottom) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    createChatMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${message.message_type}`;
        
        const time = new Date(message.timestamp * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender ${this.getSenderClass(message.message_type)}">${message.sender}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.formatMessageContent(message.content)}</div>
        `;
        
        return messageDiv;
    }

    getSenderClass(messageType) {
        switch (messageType) {
            case 'human': return 'sender-human';
            case 'llm': return 'sender-llm';
            case 'system': return 'sender-system';
            default: return 'sender-unknown';
        }
    }

    formatMessageContent(content) {
        // Basic HTML escaping and link detection
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    }

    addEvent(eventData) {
        this.events.push(eventData);
        
        // Limit number of stored events
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
        
        this.updateEventsDisplay();
    }

    updateEvents(events) {
        this.events = events || [];
        this.updateEventsDisplay();
    }

    updateEventsDisplay() {
        const eventsContainer = document.getElementById('events-list');
        if (!eventsContainer) return;
        
        // Store scroll position
        const wasAtBottom = eventsContainer.scrollTop + eventsContainer.clientHeight >= eventsContainer.scrollHeight - 5;
        
        // Clear and rebuild
        eventsContainer.innerHTML = '';
        
        // Show events in reverse chronological order (newest first)
        const sortedEvents = [...this.events].reverse();
        
        for (const event of sortedEvents) {
            const eventElement = this.createEventElement(event);
            eventsContainer.appendChild(eventElement);
        }
        
        // Auto-scroll to top for events (newest first)
        if (wasAtBottom || sortedEvents.length === this.events.length) {
            eventsContainer.scrollTop = 0;
        }
    }

    createEventElement(event) {
        const eventDiv = document.createElement('div');
        eventDiv.className = `event-item event-${event.type}`;
        
        const time = new Date(event.timestamp * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const description = this.getEventDescription(event);
        const icon = this.getEventIcon(event.type);
        
        eventDiv.innerHTML = `
            <div class="event-header">
                <span class="event-icon">${icon}</span>
                <span class="event-type">${this.formatEventType(event.type)}</span>
                <span class="event-time">${time}</span>
            </div>
            <div class="event-description">${description}</div>
        `;
        
        return eventDiv;
    }

    getEventIcon(eventType) {
        const icons = {
            detection: '👁️',
            kamikaze: '💥',
            entity_spawned: '➕',
            entity_removed: '➖',
            entity_destroyed: '💀',
            simulation_started: '▶️',
            simulation_paused: '⏸️',
            simulation_reset: '🔄'
        };
        
        return icons[eventType] || '📝';
    }

    formatEventType(eventType) {
        return eventType
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    getEventDescription(event) {
        const data = event.data || {};
        
        switch (event.type) {
            case 'detection':
                return `${data.detector_id?.substring(0, 8)} detected ${data.target_id?.substring(0, 8)} at distance ${Math.round(data.distance || 0)}`;
            
            case 'kamikaze':
                return `Drone ${data.drone_id?.substring(0, 8)} destroyed Tank ${data.tank_id?.substring(0, 8)}`;
            
            case 'entity_spawned':
                return `New ${data.entity_type} spawned: ${data.entity_id?.substring(0, 8)}`;
            
            case 'entity_removed':
                return `Entity removed: ${data.entity_id?.substring(0, 8)}`;
            
            case 'entity_destroyed':
                return `${data.entity_id?.substring(0, 8)} destroyed by ${data.cause}`;
            
            case 'simulation_started':
                return 'Simulation started';
            
            case 'simulation_paused':
                return 'Simulation paused';
            
            case 'simulation_reset':
                return 'Simulation reset';
            
            default:
                return JSON.stringify(data);
        }
    }

    clearEvents() {
        if (confirm('Clear all events?')) {
            this.events = [];
            this.updateEventsDisplay();
        }
    }

    // Utility methods for adding system messages
    addSystemMessage(content) {
        this.addChatMessage({
            sender: 'System',
            content: content,
            timestamp: Date.now() / 1000,
            message_type: 'system'
        });
    }

    addLLMMessage(droneId, content) {
        this.addChatMessage({
            sender: `Drone ${droneId.substring(0, 8)}`,
            content: content,
            timestamp: Date.now() / 1000,
            message_type: 'llm'
        });
    }

    // Format content for different message types
    formatSystemMessage(content) {
        return `🤖 ${content}`;
    }

    formatLLMMessage(content) {
        return `🧠 ${content}`;
    }

    // Export chat history (for debugging or analysis)
    exportChatHistory() {
        const data = {
            chat_messages: this.chatMessages,
            events: this.events,
            exported_at: Date.now()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_history_${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    // Search functionality
    searchMessages(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.chatMessages.filter(message => 
            message.content.toLowerCase().includes(lowercaseQuery) ||
            message.sender.toLowerCase().includes(lowercaseQuery)
        );
    }

    searchEvents(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.events.filter(event => 
            event.type.toLowerCase().includes(lowercaseQuery) ||
            this.getEventDescription(event).toLowerCase().includes(lowercaseQuery)
        );
    }
}

// Global chat system instance
window.chatSystem = null;
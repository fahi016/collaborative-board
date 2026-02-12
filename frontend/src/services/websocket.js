// src/services/websocket.js
import SockJS from 'sockjs-client/dist/sockjs';
import { Client } from '@stomp/stompjs';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws';

class WebSocketService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map();
    this.joinedRooms = new Set();
  }

  connect(onConnected) {
    if (this.connected) return;

    const token = localStorage.getItem('token');

    if (!token) {
      console.error(
        '❌ Cannot establish WebSocket connection: missing auth token. Please log in again.',
      );
      return;
    }

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        this.connected = true;
        console.log('✅ WebSocket connected');
        if (onConnected) onConnected();
      },

      onWebSocketClose: () => {
        console.warn('⚠️ WebSocket closed');
        this.connected = false;
        this.joinedRooms.clear();
      },

      debug: (msg) => console.log('[STOMP]', msg),
    });

    this.client.activate();
  }

  disconnect() {
    if (!this.client) return;

    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.clear();
    this.joinedRooms.clear();

    this.client.deactivate();
    this.connected = false;

    console.log('🔌 WebSocket disconnected');
  }

  subscribe(destination, callback) {
    if (!this.connected || this.subscriptions.has(destination)) return;

    const sub = this.client.subscribe(destination, msg =>
      callback(JSON.parse(msg.body))
    );

    this.subscriptions.set(destination, sub);
  }

  send(destination, payload) {
    if (!this.connected || !this.client) return;

    this.client.publish({
      destination,
      body: JSON.stringify(payload),
    });
  }

  joinRoom(roomId, payload) {
    if (this.joinedRooms.has(roomId)) return;

    this.client.publish({
      destination: `/app/room/${roomId}/join`,
      body: JSON.stringify(payload),
    });

    this.joinedRooms.add(roomId);
  }

  leaveRoom(roomId, payload) {
    if (!this.connected) return;

    this.client.publish({
      destination: `/app/room/${roomId}/leave`,
      body: JSON.stringify(payload),
    });

    this.joinedRooms.delete(roomId);
  }
}

export const wsService = new WebSocketService();

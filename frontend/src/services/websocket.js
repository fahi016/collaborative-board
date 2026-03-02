import SockJS from 'sockjs-client/dist/sockjs';
import { Client } from '@stomp/stompjs';
import { logger } from '../utils/logger';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws';

class WebSocketService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map();
    this.joinedRooms = new Set();
    this.errorHandler = null;
    this.disconnectHandler = null;
    this._connectedToken = null;
  }

  connect(onConnected, onError, onDisconnect) {
    const token = localStorage.getItem('token');
    if (!token) {
      logger.error('Cannot connect WebSocket: missing auth token.');
      return;
    }

    if (this.connected) {
      if (this._connectedToken === token) {
        if (onConnected) onConnected();
        return;
      }
      logger.warn('Token changed. Tearing down stale WebSocket connection.');
      this._forceDisconnect();
    }

    this.errorHandler = onError || null;
    this.disconnectHandler = onDisconnect || null;
    this._connectedToken = token;

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      beforeConnect: () => {
        const latestToken = localStorage.getItem('token');
        if (!latestToken) {
          throw new Error('Missing auth token for WebSocket reconnect');
        }
        this.client.connectHeaders = { Authorization: `Bearer ${latestToken}` };
      },
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        this.connected = true;
        logger.info('WebSocket connected');
        if (onConnected) onConnected();
      },

      onWebSocketClose: () => {
        logger.warn('WebSocket closed');
        if (this.connected && this.disconnectHandler) this.disconnectHandler();
        this._reset();
      },

      onStompError: (frame) => {
        logger.error('STOMP error', frame.body);
        this._reset();
        if (this.errorHandler) this.errorHandler(frame.body || 'WebSocket error');
      },

      onWebSocketError: (event) => {
        logger.error('WebSocket error', event);
        this._reset();
        if (this.errorHandler) this.errorHandler('WebSocket connection error');
      },

      debug: () => {},
    });

    this.client.activate();
  }

  _reset() {
    this.connected = false;
    this._connectedToken = null;
    this.subscriptions.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch (_) {}
    });
    this.subscriptions.clear();
    this.joinedRooms.clear();
  }

  _forceDisconnect() {
    this._reset();
    if (this.client) {
      try {
        this.client.forceDisconnect();
      } catch (_) {}
      this.client = null;
    }
  }

  disconnect() {
    if (!this.client) return;
    this._reset();
    try {
      this.client.deactivate();
    } catch (_) {}
    this.client = null;
    logger.info('WebSocket disconnected');
  }

  synchronousLeave(roomId, userName) {
    const token = localStorage.getItem('token');
    if (!token || !roomId) return;

    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/rooms/${roomId}/session-leave`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userName }),
    }).catch(() => {});
  }

  subscribe(destination, callback) {
    if (!this.connected || this.subscriptions.has(destination)) return;
    const sub = this.client.subscribe(destination, (msg) => {
      try {
        const parsed = JSON.parse(msg.body);
        callback(parsed);
      } catch (e) {
        logger.error('Failed to parse WebSocket message', e, msg.body);
      }
    });
    this.subscriptions.set(destination, sub);
  }

  send(destination, payload) {
    if (!this.connected || !this.client) return;
    this.client.publish({ destination, body: JSON.stringify(payload) });
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

  sendVoiceSignal(roomId, payload) {
    if (!this.connected || !this.client) return;
    this.client.publish({
      destination: `/app/room/${roomId}/voice/signal`,
      body: JSON.stringify(payload),
    });
  }

  sendVoiceMic(roomId, muted) {
    if (!this.connected || !this.client) return;
    this.client.publish({
      destination: `/app/room/${roomId}/voice/mic`,
      body: JSON.stringify({ muted }),
    });
  }

  sendChatMessage(roomId, content) {
    if (!this.connected || !this.client) return;
    this.client.publish({
      destination: `/app/room/${roomId}/chat`,
      body: JSON.stringify({ content }),
    });
  }
}

export const wsService = new WebSocketService();

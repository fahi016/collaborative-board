// src/services/api.js
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const getAuthHeaders = (extra = {}) => {
  const token = localStorage.getItem('token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};

export const api = {
  createRoom: async () => {
    const res = await fetch(`${API_BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (res.status === 403) {
      throw new Error('You are not allowed to create rooms. Please log in again.');
    }
    if (!res.ok) throw new Error('Failed to create room');
    return res.json();
  },

  // Join a room using REST (Session-Id header)
  joinRoom: async (roomId, sessionId) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
        ...(sessionId ? { 'Session-Id': sessionId } : {}),
      }),
      body: JSON.stringify({}),
    });

    if (res.status === 409) {
      throw new Error('Room is full');
    }
    if (res.status === 404) {
      throw new Error('Room not found');
    }
    if (res.status === 403) {
      throw new Error('You are not allowed to join this room.');
    }
    if (!res.ok) throw new Error('Failed to join room');

    return res.json();
  },

  getRoomInfo: async (roomId) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`, {
      headers: getAuthHeaders(),
    });
    if (res.status === 403) {
      throw new Error('You are not allowed to view this room.');
    }
    if (!res.ok) throw new Error('Room not found');
    return res.json();
  },

  getActiveUsers: async (roomId) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/users`, {
      headers: getAuthHeaders(),
    });
    if (res.status === 403) {
      throw new Error('You are not allowed to view users in this room.');
    }
    if (!res.ok) throw new Error('Failed to get users');
    return res.json();
  },

  // Board state APIs for loading/syncing canvas history
  getBoardState: async (roomId, pageNumber = 1) => {
    const res = await fetch(
      `${API_BASE_URL}/api/rooms/${roomId}/state?pageNumber=${pageNumber}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (res.status === 403) {
      throw new Error('You are not allowed to access this board.');
    }
    if (!res.ok) throw new Error('Failed to load board state');
    return res.json();
  },

  updateBoardState: async (roomId, { pageNumber = 1, canvasData }) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/state`, {
      method: 'PUT',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ pageNumber, canvasData }),
    });
    if (res.status === 403) {
      throw new Error('You are not allowed to save this board.');
    }
    if (!res.ok) throw new Error('Failed to save board state');
    return res.json();
  },

  clearBoardState: async (roomId, pageNumber = 1) => {
    const res = await fetch(
      `${API_BASE_URL}/api/rooms/${roomId}/state?pageNumber=${pageNumber}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      },
    );
    if (res.status === 403) {
      throw new Error('You are not allowed to clear this board.');
    }
    if (!res.ok) throw new Error('Failed to clear board');
    return res.json();
  },
};

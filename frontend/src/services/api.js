// src/services/api.js
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const api = {
  createRoom: async () => {
    const res = await fetch(`${API_BASE_URL}/api/rooms`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to create room');
    return res.json();
  },

  getRoomInfo: async (roomId) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`);
    if (!res.ok) throw new Error('Room not found');
    return res.json();
  },

  getActiveUsers: async (roomId) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/users`);
    if (!res.ok) throw new Error('Failed to get users');
    return res.json();
  },

  // Board state APIs for loading/syncing canvas history
  getBoardState: async (roomId, pageNumber = 1) => {
    const res = await fetch(
      `${API_BASE_URL}/api/rooms/${roomId}/state?pageNumber=${pageNumber}`,
    );
    if (!res.ok) throw new Error('Failed to load board state');
    return res.json();
  },

  updateBoardState: async (roomId, { pageNumber = 1, canvasData }) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pageNumber, canvasData }),
    });
    if (!res.ok) throw new Error('Failed to save board state');
    return res.json();
  },

  clearBoardState: async (roomId, pageNumber = 1) => {
    const res = await fetch(
      `${API_BASE_URL}/api/rooms/${roomId}/state?pageNumber=${pageNumber}`,
      {
        method: 'DELETE',
      },
    );
    if (!res.ok) throw new Error('Failed to clear board');
    return res.json();
  },
};

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

const handleJsonResponse = async (res, defaultErrorMessage) => {
  if (res.ok) {
    return res.json();
  }

  let message = defaultErrorMessage;
  try {
    const body = await res.json();
    message =
      body?.message ||
      body?.error ||
      body?.details ||
      message;
  } catch {
    // ignore JSON parse errors and fall back to default
  }

  if (res.status === 401) {
    // Token likely invalid or expired – clear client-side auth
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  throw new Error(message);
};

export const api = {
  createRoom: async (name) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ name }),
    });
    if (res.status === 403) {
      throw new Error('You are not allowed to create rooms. Please log in again.');
    }
    return handleJsonResponse(res, 'Failed to create room');
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

    return handleJsonResponse(res, 'Failed to join room');
  },

  getRoomInfo: async (roomId) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`, {
      headers: getAuthHeaders(),
    });
    if (res.status === 403) {
      throw new Error('You are not allowed to view this room.');
    }
    return handleJsonResponse(res, 'Room not found');
  },

  getActiveUsers: async (roomId) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/users`, {
      headers: getAuthHeaders(),
    });
    if (res.status === 403) {
      throw new Error('You are not allowed to view users in this room.');
    }
    return handleJsonResponse(res, 'Failed to get users');
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
    return handleJsonResponse(res, 'Failed to load board state');
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
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body?.message ||
          'Board cannot be updated while users are in the room. Changes are saved automatically when the room is empty.',
      );
    }
    return handleJsonResponse(res, 'Failed to save board state');
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
    return handleJsonResponse(res, 'Failed to clear board');
  },

  // Get rooms for the current authenticated user (owned + joined)
  getMyRooms: async () => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/my`, {
      headers: getAuthHeaders(),
    });
    if (res.status === 403) {
      throw new Error('You are not allowed to view your rooms.');
    }
    return handleJsonResponse(res, 'Failed to load your rooms');
  },

  // Update room name (only owner)
  updateRoom: async (roomId, name) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`, {
      method: 'PUT',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ name }),
    });
    if (res.status === 403) {
      throw new Error('Only the room owner can update the room name.');
    }
    return handleJsonResponse(res, 'Failed to update room');
  },

  // Delete room (only owner)
  deleteRoom: async (roomId) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.status === 403) {
      throw new Error('Only the room owner can delete the room.');
    }
    if (res.status === 204) {
      return null; // No content
    }
    return handleJsonResponse(res, 'Failed to delete room');
  },

  // Leave room (joined users only, not owners)
  leaveRoom: async (roomId) => {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (res.status === 400) {
      throw new Error('Room owners cannot leave their own room. Please delete the room instead.');
    }
    if (res.status === 200) {
      return null; // Success
    }
    return handleJsonResponse(res, 'Failed to leave room');
  },

  // Get chat message history for a room (paginated)
  getChatHistory: async (roomId, page = 0, size = 50) => {
    const res = await fetch(
      `${API_BASE_URL}/api/rooms/${roomId}/messages?page=${page}&size=${size}`,
      {
        headers: getAuthHeaders(),
      },
    );
    if (res.status === 403) {
      throw new Error('You are not allowed to view chat history.');
    }
    if (res.status === 404) {
      throw new Error('Room not found.');
    }
    return handleJsonResponse(res, 'Failed to load chat history');
  },
};
// src/components/JoinRoomModal.jsx
import { useState } from 'react';
import { api } from '../services/api';

function JoinRoomModal({ onJoinRoom }) {
  const [userName, setUserName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // ✅ REST: only create room
      const roomData = await api.createRoom();

      // ✅ Move to board (NO REST JOIN)
      onJoinRoom(roomData.roomId, userName);
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!roomIdInput.trim()) {
      setError('Please enter room ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // ✅ Optional: validate room exists (REST read-only)
      await api.getRoomInfo(roomIdInput.toUpperCase());

      // ✅ Move to board (NO REST JOIN)
      onJoinRoom(roomIdInput.toUpperCase(), userName);
    } catch (err) {
      setError(err.message || 'Room not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
          Collaborative Board
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Real-time drawing and collaboration
        </p>

        {/* User Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            maxLength={50}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Toggle */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setIsCreating(false)}
            className={`flex-1 py-2 rounded-md ${!isCreating
              ? 'bg-white shadow text-blue-600 font-medium'
              : 'text-gray-600'
              }`}
          >
            Join Room
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className={`flex-1 py-2 rounded-md ${isCreating
              ? 'bg-white shadow text-blue-600 font-medium'
              : 'text-gray-600'
              }`}
          >
            Create Room
          </button>
        </div>

        {/* Join Room */}
        {!isCreating && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room ID
            </label>
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
              placeholder="Enter 6-character room ID"
              maxLength={6}
              className="w-full px-4 py-2 border rounded-lg uppercase focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={isCreating ? handleCreateRoom : handleJoinRoom}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg disabled:opacity-50"
        >
          {loading
            ? isCreating
              ? 'Creating...'
              : 'Joining...'
            : isCreating
              ? 'Create New Room'
              : 'Join Room'}
        </button>

        <p className="text-xs text-center text-gray-500 mt-6">
          Max 3 users per room • WebSocket-based presence
        </p>
      </div>
    </div>
  );
}

export default JoinRoomModal;

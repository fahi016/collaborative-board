import { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// FIX: Removed the localStorage activeRoom guard entirely.
// It was blocking users from rejoining after a tab refresh because:
//   1. pagehide clears activeRoom, but React re-renders haven't run yet on refresh
//   2. the guard read the still-set activeRoom and showed "already active in another tab"
// The backend already enforces single-session-per-room via ghost session eviction,
// so this frontend guard was both redundant AND harmful. The only real use case it
// solved (blocking a second tab) is now handled server-side.

function JoinRoomModal({ onJoinRoom }) {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');
    try {
      const roomData = await api.createRoom();
      showToast(`Room ${roomData.roomId} created`, 'success');
      onJoinRoom(roomData.roomId, user?.name || '');
    } catch (err) {
      const msg = err.message || 'Failed to create room';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomIdInput.trim()) {
      setError('Please enter room ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const info = await api.getRoomInfo(roomIdInput.toUpperCase());

      const currentUsers = info.currentUsers ?? info.currentusers;
      const maxUsers = info.maxUsers ?? info.maxusers;
      const isFullFlag = info.isFull ?? info.full;

      const isRoomFull =
        Boolean(isFullFlag) ||
        (typeof currentUsers === 'number' &&
          typeof maxUsers === 'number' &&
          currentUsers >= maxUsers);

      if (isRoomFull) {
        const msg = 'This room is full (max 6 users).';
        setError(msg);
        showToast(msg, 'error');
        return;
      }

      onJoinRoom(roomIdInput.toUpperCase(), user?.name || '');
      showToast(`Joined room ${roomIdInput.toUpperCase()}`, 'success');
    } catch (err) {
      const msg = err.message || 'Failed to join room';
      setError(msg);
      showToast(msg, 'error');
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

        {/* User Info */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">Logged in as:</p>
          <p className="font-medium text-gray-800">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <button
            onClick={logout}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            Logout
          </button>
        </div>

        {/* Create or Join Toggle */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setIsCreating(false)}
            className={`flex-1 py-2 rounded-md transition ${!isCreating
                ? 'bg-white shadow text-blue-600 font-medium'
                : 'text-gray-600'
              }`}
          >
            Join Room
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className={`flex-1 py-2 rounded-md transition ${isCreating
                ? 'bg-white shadow text-blue-600 font-medium'
                : 'text-gray-600'
              }`}
          >
            Create Room
          </button>
        </div>

        {/* Join Room Section */}
        {!isCreating && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room ID
            </label>
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
              placeholder="Enter 10-character room ID"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase"
              maxLength={10}
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={isCreating ? handleCreateRoom : handleJoinRoom}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {isCreating ? 'Creating...' : 'Joining...'}
            </span>
          ) : isCreating ? (
            'Create New Room'
          ) : (
            'Join Room'
          )}
        </button>

        <p className="text-xs text-center text-gray-500 mt-6">
          Max 6 users per room
        </p>
      </div>
    </div>
  );
}

export default JoinRoomModal;
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function JoinRoomModal({ onJoinRoom }) {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, logout } = useAuth();
  const { showToast } = useToast();

   const [activeRoomInfo, setActiveRoomInfo] = useState(null);

   // Keep local active room info in sync with localStorage,
   // so other tabs see the same state.
   useEffect(() => {
     const loadActiveRoom = () => {
       try {
         const raw = localStorage.getItem('activeRoom');
         setActiveRoomInfo(raw ? JSON.parse(raw) : null);
       } catch {
         setActiveRoomInfo(null);
       }
     };

     loadActiveRoom();

     const handleStorage = (event) => {
       if (event.key === 'activeRoom') {
         loadActiveRoom();
       }
     };

     window.addEventListener('storage', handleStorage);
     return () => window.removeEventListener('storage', handleStorage);
   }, []);

   const isUserAlreadyActive =
     !!activeRoomInfo && activeRoomInfo.userEmail === user?.email;

  const handleCreateRoom = async () => {
    // Frontend guard: same authenticated user should not
    // create/join another room from a different tab/window.
    if (isUserAlreadyActive) {
      const msg = `You are already active in room ${activeRoomInfo.roomId} in another tab. Please close that tab or reset your status before creating a new room.`;
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create room (REST)
      const roomData = await api.createRoom();

      showToast(`Room ${roomData.roomId} created`, 'success');

      // Move directly to board; WebSocket will handle presence/join
      // Use authenticated user's name so backend can enforce "one room per user"
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

    // Frontend guard: same authenticated user should not
    // join another room (or same room) in a different tab.
    if (isUserAlreadyActive) {
      const msg = `You are already active in room ${activeRoomInfo.roomId} in another tab. Please close that tab or reset your status before joining a room.`;
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Validate room exists and is not full
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
        const msg = 'This room is full (max 3 users).';
        setError(msg);
        showToast(msg, 'error');
        return;
      }

      // Move to board; WebSocket join will be done in CollaborativeBoard
      // Use authenticated user's name so backend can enforce "one room per user"
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


        {/* Name is now fixed to authenticated user to enforce one-room-per-user */}

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
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
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
          Max 3 users per room • Page 1 only
        </p>
      </div>
    </div>
  );
}

export default JoinRoomModal;
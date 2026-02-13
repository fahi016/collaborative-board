import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function MyRooms({ onJoinRoom }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [roomNameInput, setRoomNameInput] = useState('');
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRoomName, setEditingRoomName] = useState('');
  const [deletingRoomId, setDeletingRoomId] = useState(null);
  const [leavingRoomId, setLeavingRoomId] = useState(null);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  // Track active room to prevent joining multiple rooms from different tabs
  const [activeRoomInfo, setActiveRoomInfo] = useState(null);

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

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await api.getMyRooms();
        setRooms(data);
      } catch (err) {
        const msg = err.message || 'Failed to load your rooms';
        setError(msg);
        showToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [showToast]);

  const handleCreateRoom = async () => {
    if (isUserAlreadyActive) {
      const msg = `You are already active in room ${activeRoomInfo.roomId} in another tab. Please close that tab or reset your status before creating a new room.`;
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    if (!roomNameInput.trim()) {
      setError('Please enter a room name');
      showToast('Please enter a room name', 'error');
      return;
    }

    try {
      setCreating(true);
      setError('');
      const roomData = await api.createRoom(roomNameInput.trim());
      showToast(`Room "${roomData.name || roomData.roomId}" created`, 'success');
      setRoomNameInput(''); // Clear input
      // Refresh rooms list
      const data = await api.getMyRooms();
      setRooms(data);
      onJoinRoom(roomData.roomId, user?.name || '');
    } catch (err) {
      const msg = err.message || 'Failed to create room';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinExistingRoom = async (room) => {
    if (isUserAlreadyActive) {
      const msg = `You are already active in room ${activeRoomInfo.roomId} in another tab. Please close that tab or reset your status before joining a room.`;
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    // Pre-check: ensure room is not full
    try {
      const info = await api.getRoomInfo(room.roomId);
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

      onJoinRoom(room.roomId, user?.name || '');
      showToast(`Joined room ${room.roomId}`, 'success');
    } catch (err) {
      const msg = err.message || 'Failed to join room';
      setError(msg);
      showToast(msg, 'error');
    }
  };

  const handleJoinRoomById = async () => {
    if (!roomIdInput.trim()) {
      setError('Please enter a room ID');
      return;
    }

    if (isUserAlreadyActive) {
      const msg = `You are already active in room ${activeRoomInfo.roomId} in another tab. Please close that tab or reset your status before joining a room.`;
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const roomId = roomIdInput.trim().toUpperCase();
      
      // Validate room exists and is not full
      const info = await api.getRoomInfo(roomId);
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

      onJoinRoom(roomId, user?.name || '');
      showToast(`Joined room ${roomId}`, 'success');
      setRoomIdInput(''); // Clear input after successful join
    } catch (err) {
      const msg = err.message || 'Failed to join room';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setJoining(false);
    }
  };

  const handleUpdateRoom = async (roomId, newName) => {
    if (!newName.trim()) {
      showToast('Room name cannot be empty', 'error');
      return;
    }

    try {
      await api.updateRoom(roomId, newName.trim());
      showToast('Room name updated', 'success');
      setEditingRoomId(null);
      setEditingRoomName('');
      // Refresh rooms list
      const data = await api.getMyRooms();
      setRooms(data);
    } catch (err) {
      const msg = err.message || 'Failed to update room';
      showToast(msg, 'error');
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingRoomId(roomId);
      await api.deleteRoom(roomId);
      showToast('Room deleted', 'success');
      // Refresh rooms list
      const data = await api.getMyRooms();
      setRooms(data);
    } catch (err) {
      const msg = err.message || 'Failed to delete room';
      showToast(msg, 'error');
    } finally {
      setDeletingRoomId(null);
    }
  };

  const handleLeaveRoom = async (roomId) => {
    if (!window.confirm('Are you sure you want to leave this room?')) {
      return;
    }

    try {
      setLeavingRoomId(roomId);
      await api.leaveRoom(roomId);
      showToast('Left room', 'success');
      // Refresh rooms list
      const data = await api.getMyRooms();
      setRooms(data);
    } catch (err) {
      const msg = err.message || 'Failed to leave room';
      showToast(msg, 'error');
    } finally {
      setLeavingRoomId(null);
    }
  };

  // Separate rooms into owned and joined
  const ownedRooms = rooms.filter((room) => room.owner);
  const joinedRooms = rooms.filter((room) => !room.owner);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Your Rooms</h1>
            <p className="text-sm text-gray-600 mt-1">
              Welcome back, <span className="font-medium">{user?.name}</span> ({user?.email})
            </p>
          </div>
          <button
            onClick={logout}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Logout
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Rooms Lists */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3 text-gray-600">
              <svg
                className="animate-spin h-5 w-5 text-blue-600"
                viewBox="0 0 24 24"
              >
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
              <span className="text-sm font-medium">Loading rooms…</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Join Room by ID Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-3">
                Join Room by ID
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                  placeholder="Enter 10-character room ID"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase font-mono text-sm"
                  maxLength={10}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleJoinRoomById();
                    }
                  }}
                />
                <button
                  onClick={handleJoinRoomById}
                  disabled={joining || !roomIdInput.trim()}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joining ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin h-4 w-4 mr-2"
                        viewBox="0 0 24 24"
                      >
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
                      Joining...
                    </span>
                  ) : (
                    'Join Room'
                  )}
                </button>
              </div>
            </div>

            {/* Owned Rooms Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-3">
                Rooms You Created
              </h2>
              {ownedRooms.length === 0 ? (
                <div className="text-sm text-gray-500 py-4 px-4 bg-gray-50 rounded-lg">
                  You haven't created any rooms yet. Create one to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {ownedRooms.map((room) => (
                    <div
                      key={room.roomId}
                      className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="flex-1 flex items-center space-x-3">
                        {editingRoomId === room.roomId ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingRoomName}
                              onChange={(e) => setEditingRoomName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateRoom(room.roomId, editingRoomName);
                                } else if (e.key === 'Escape') {
                                  setEditingRoomId(null);
                                  setEditingRoomName('');
                                }
                              }}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateRoom(room.roomId, editingRoomName)}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingRoomId(null);
                                setEditingRoomName('');
                              }}
                              className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleJoinExistingRoom(room)}
                              className="flex-1 text-left"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-gray-800">
                                  {room.name || room.roomId}
                                </span>
                                <span className="font-mono text-xs text-gray-500">
                                  ({room.roomId})
                                </span>
                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                                  Owner
                                </span>
                                {room.full && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                                    Full
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Created:{' '}
                                {room.createdAt
                                  ? new Date(room.createdAt).toLocaleString()
                                  : 'N/A'}
                              </div>
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRoomId(room.roomId);
                                  setEditingRoomName(room.name || '');
                                }}
                                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                title="Edit room name"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRoom(room.roomId);
                                }}
                                disabled={deletingRoomId === room.roomId}
                                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                                title="Delete room"
                              >
                                {deletingRoomId === room.roomId ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 ml-4">
                        {room.currentUsers}/{room.maxUsers} users
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Joined Rooms Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-3">
                Rooms You've Joined
              </h2>
              {joinedRooms.length === 0 ? (
                <div className="text-sm text-gray-500 py-4 px-4 bg-gray-50 rounded-lg">
                  You haven't joined any rooms yet. Join a room by entering a room ID or create your own.
                </div>
              ) : (
                <div className="space-y-2">
                  {joinedRooms.map((room) => (
                    <div
                      key={room.roomId}
                      className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <button
                        onClick={() => handleJoinExistingRoom(room)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-800">
                            {room.name || room.roomId}
                          </span>
                          <span className="font-mono text-xs text-gray-500">
                            ({room.roomId})
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                            Joined
                          </span>
                          {room.full && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                              Full
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Last joined:{' '}
                          {room.lastJoinedAt
                            ? new Date(room.lastJoinedAt).toLocaleString()
                            : 'N/A'}
                        </div>
                      </button>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLeaveRoom(room.roomId);
                          }}
                          disabled={leavingRoomId === room.roomId}
                          className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50"
                          title="Leave room"
                        >
                          {leavingRoomId === room.roomId ? 'Leaving...' : 'Leave'}
                        </button>
                        <div className="text-sm text-gray-600">
                          {room.currentUsers}/{room.maxUsers} users
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Room Section */}
        <div className="mt-6 pt-6 border-t">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            Create New Room
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomNameInput}
              onChange={(e) => setRoomNameInput(e.target.value)}
              placeholder="Enter room name"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateRoom();
                }
              }}
            />
            <button
              onClick={handleCreateRoom}
              disabled={creating || !roomNameInput.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
                    viewBox="0 0 24 24"
                  >
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
                  Creating...
                </span>
              ) : (
                'Create Room'
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Max 3 users per room • Page 1 only
          </p>
        </div>
      </div>
    </div>
  );
}

export default MyRooms;

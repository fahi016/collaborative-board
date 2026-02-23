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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-elevation-2 border border-slate-700/50 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-elevation-1">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Your Rooms</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Welcome back, <span className="font-semibold text-white">{user?.name}</span>
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-xl transition-smooth flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300 text-sm flex items-start space-x-2 shadow-elevation-1">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Rooms Lists */}
        {loading ? (
          <div className="bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-elevation-2 border border-slate-700/50 p-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <svg
                className="animate-spin h-8 w-8 text-blue-500"
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
              <span className="text-sm font-medium text-slate-400">Loading rooms…</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Join Room by ID Section */}
            <div className="bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-elevation-2 border border-slate-700/50 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <h2 className="text-lg font-bold text-white">
                  Join Room by ID
                </h2>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                    placeholder="Enter 10-character room ID"
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase font-mono text-sm transition-smooth text-white placeholder-slate-500"
                    maxLength={10}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleJoinRoomById();
                      }
                    }}
                  />
                </div>
                <button
                  onClick={handleJoinRoomById}
                  disabled={joining || !roomIdInput.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm font-semibold rounded-xl shadow-elevation-1 hover:shadow-elevation-2 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {joining ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
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
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span>Join</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Owned Rooms Section */}
            <div className="bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-elevation-2 border border-slate-700/50 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <h2 className="text-lg font-bold text-white">
                  Rooms You Created
                </h2>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full border border-blue-500/30">
                  {ownedRooms.length}
                </span>
              </div>
              {ownedRooms.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-sm text-slate-400 font-medium">You haven't created any rooms yet</p>
                  <p className="text-xs text-slate-500 mt-1">Create one below to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ownedRooms.map((room) => (
                    <div
                      key={room.roomId}
                      className="w-full flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700 rounded-xl hover:bg-slate-900/70 hover:shadow-elevation-1 transition-smooth group"
                    >
                      <div className="flex-1 flex items-center space-x-4">
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
                              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-smooth text-white"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateRoom(room.roomId, editingRoomName)}
                              className="px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-500 transition-smooth flex items-center space-x-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => {
                                setEditingRoomId(null);
                                setEditingRoomName('');
                              }}
                              className="px-3 py-2 bg-slate-700 text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-600 transition-smooth"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleJoinExistingRoom(room)}
                              className="flex-1 text-left group-hover:text-blue-400 transition-colors"
                            >
                              <div className="flex items-center space-x-2 flex-wrap">
                                <span className="font-bold text-white text-base">
                                  {room.name || room.roomId}
                                </span>
                                <span className="font-mono text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                                  {room.roomId}
                                </span>
                                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                                  Owner
                                </span>
                                {room.full && (
                                  <span className="px-2 py-0.5 text-xs font-semibold bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                                    Full
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-1.5 flex items-center space-x-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>
                                  Created {room.createdAt
                                    ? new Date(room.createdAt).toLocaleDateString()
                                    : 'N/A'}
                                </span>
                              </div>
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRoomId(room.roomId);
                                  setEditingRoomName(room.name || '');
                                }}
                                className="p-2 text-blue-400 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 transition-smooth border border-blue-500/30"
                                title="Edit room name"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRoom(room.roomId);
                                }}
                                disabled={deletingRoomId === room.roomId}
                                className="p-2 text-red-400 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-smooth disabled:opacity-50 border border-red-500/30"
                                title="Delete room"
                              >
                                {deletingRoomId === room.roomId ? (
                                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700/50 rounded-lg border border-slate-600">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className="text-sm font-semibold text-slate-300">
                          {room.currentUsers}/{room.maxUsers}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Joined Rooms Section */}
            <div className="bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-elevation-2 border border-slate-700/50 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h2 className="text-lg font-bold text-white">
                  Rooms You've Joined
                </h2>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/30">
                  {joinedRooms.length}
                </span>
              </div>
              {joinedRooms.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-sm text-slate-400 font-medium">You haven't joined any rooms yet</p>
                  <p className="text-xs text-slate-500 mt-1">Join a room by entering a room ID above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {joinedRooms.map((room) => (
                    <div
                      key={room.roomId}
                      className="w-full flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700 rounded-xl hover:bg-slate-900/70 hover:shadow-elevation-1 transition-smooth group"
                    >
                      <button
                        onClick={() => handleJoinExistingRoom(room)}
                        className="flex-1 text-left group-hover:text-blue-400 transition-colors"
                      >
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-bold text-white text-base">
                            {room.name || room.roomId}
                          </span>
                          <span className="font-mono text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                            {room.roomId}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                            Joined
                          </span>
                          {room.full && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                              Full
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1.5 flex items-center space-x-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>
                            Last joined {room.lastJoinedAt
                              ? new Date(room.lastJoinedAt).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLeaveRoom(room.roomId);
                          }}
                          disabled={leavingRoomId === room.roomId}
                          className="p-2 text-orange-400 bg-orange-500/20 rounded-lg hover:bg-orange-500/30 transition-smooth disabled:opacity-50 border border-orange-500/30"
                          title="Leave room"
                        >
                          {leavingRoomId === room.roomId ? (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                          )}
                        </button>
                        <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700/50 rounded-lg border border-slate-600">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span className="text-sm font-semibold text-slate-300">
                            {room.currentUsers}/{room.maxUsers}
                          </span>
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
        <div className="bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-elevation-2 border border-slate-700/50 p-6 mt-6">
          <div className="flex items-center space-x-2 mb-4">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <h2 className="text-lg font-bold text-white">
              Create New Room
            </h2>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <input
                type="text"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                placeholder="Enter room name"
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm transition-smooth text-white placeholder-slate-500"
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateRoom();
                  }
                }}
              />
            </div>
            <button
              onClick={handleCreateRoom}
              disabled={creating || !roomNameInput.trim()}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl shadow-elevation-1 hover:shadow-elevation-2 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {creating ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
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
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3 flex items-center space-x-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Max 3 users per room • Page 1 only</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default MyRooms;

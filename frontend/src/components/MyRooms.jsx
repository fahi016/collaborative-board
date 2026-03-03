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
  const [activeRoomInfo, setActiveRoomInfo] = useState(null);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('activeRoom');
        setActiveRoomInfo(raw ? JSON.parse(raw) : null);
      } catch { setActiveRoomInfo(null); }
    };
    load();
    const h = e => { if (e.key === 'activeRoom') load(); };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);

  const isUserAlreadyActive = !!activeRoomInfo && activeRoomInfo.userEmail === user?.email;

  useEffect(() => {
    (async () => {
      try { setLoading(true); setError(''); setRooms(await api.getMyRooms()); }
      catch (err) { const m = err.message || 'Failed to load rooms'; setError(m); showToast(m, 'error'); }
      finally { setLoading(false); }
    })();
  }, [showToast]);

  const refresh = async () => setRooms(await api.getMyRooms());

  const guardActive = () => {
    if (isUserAlreadyActive) {
      const m = `Already active in room ${activeRoomInfo.roomId} in another tab.`;
      setError(m); showToast(m, 'error'); return true;
    }
    return false;
  };

  const handleCreateRoom = async () => {
    if (guardActive()) return;
    if (!roomNameInput.trim()) { setError('Please enter a room name'); return; }
    try {
      setCreating(true); setError('');
      const d = await api.createRoom(roomNameInput.trim());
      showToast(`Room created`, 'success');
      setRoomNameInput('');
      await refresh();
      onJoinRoom(d.roomId, user?.name || '');
    } catch (err) { const m = err.message || 'Failed to create room'; setError(m); showToast(m, 'error'); }
    finally { setCreating(false); }
  };

  const handleJoinExisting = async (room) => {
    if (guardActive()) return;
    try {
      const info = await api.getRoomInfo(room.roomId);
      const cu = info.currentUsers ?? info.currentusers;
      const mu = info.maxUsers ?? info.maxusers;
      if (Boolean(info.isFull ?? info.full) || (typeof cu === 'number' && typeof mu === 'number' && cu >= mu)) {
        const m = 'Room is full (max 6 users).'; setError(m); showToast(m, 'error'); return;
      }
      onJoinRoom(room.roomId, user?.name || '');
      showToast(`Joined room`, 'success');
    } catch (err) { const m = err.message || 'Failed to join'; setError(m); showToast(m, 'error'); }
  };

  const handleJoinById = async () => {
    if (!roomIdInput.trim()) { setError('Please enter a room ID'); return; }
    if (guardActive()) return;
    setJoining(true); setError('');
    try {
      const id = roomIdInput.trim().toUpperCase();
      const info = await api.getRoomInfo(id);
      const cu = info.currentUsers ?? info.currentusers;
      const mu = info.maxUsers ?? info.maxusers;
      if (Boolean(info.isFull ?? info.full) || (typeof cu === 'number' && typeof mu === 'number' && cu >= mu)) {
        const m = 'Room is full (max 6 users).'; setError(m); showToast(m, 'error'); return;
      }
      onJoinRoom(id, user?.name || '');
      showToast(`Joined room`, 'success');
      setRoomIdInput('');
    } catch (err) { const m = err.message || 'Failed to join'; setError(m); showToast(m, 'error'); }
    finally { setJoining(false); }
  };

  const handleUpdateRoom = async (roomId, newName) => {
    if (!newName.trim()) { showToast('Name cannot be empty', 'error'); return; }
    try {
      await api.updateRoom(roomId, newName.trim());
      showToast('Room renamed', 'success');
      setEditingRoomId(null); setEditingRoomName('');
      await refresh();
    } catch (err) { showToast(err.message || 'Failed to rename', 'error'); }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Delete this room? This cannot be undone.')) return;
    try {
      setDeletingRoomId(roomId);
      await api.deleteRoom(roomId);
      showToast('Room deleted', 'success');
      await refresh();
    } catch (err) { showToast(err.message || 'Failed to delete', 'error'); }
    finally { setDeletingRoomId(null); }
  };

  const handleLeaveRoom = async (roomId) => {
    if (!window.confirm('Leave this room?')) return;
    try {
      setLeavingRoomId(roomId);
      await api.leaveRoom(roomId);
      showToast('Left room', 'success');
      await refresh();
    } catch (err) { showToast(err.message || 'Failed to leave', 'error'); }
    finally { setLeavingRoomId(null); }
  };

  const ownedRooms = rooms.filter(r => r.owner);
  const joinedRooms = rooms.filter(r => !r.owner);

  const Spinner = () => (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* Top nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#fff' }}>
            <svg className="w-4 h-4" fill="#0a0a0a" viewBox="0 0 24 24"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 5h2v-2h2v2h2v2h-2v2h-2v-2h-2v-2z"/></svg>
          </div>
          <span className="font-bold text-white tracking-tight">Collab Board</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white">{user?.name}</p>
            <p className="text-xs" style={{ color: '#555' }}>{user?.email}</p>
          </div>
          <button onClick={logout} className="btn-ghost rounded-lg px-3 py-2 text-xs flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-white">Rooms</h1>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>Manage and join your collaboration spaces.</p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg px-4 py-3 text-xs flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
            {error}
          </div>
        )}

        {/* Actions row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Create room */}
          <div className="card rounded-xl p-4">
            <p className="text-xs font-semibold mb-3" style={{ color: '#888' }}>NEW ROOM</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomNameInput}
                onChange={e => setRoomNameInput(e.target.value)}
                placeholder="Room name"
                className="input-base flex-1 rounded-lg px-3 py-2 text-sm"
                maxLength={100}
                onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
              />
              <button onClick={handleCreateRoom} disabled={creating || !roomNameInput.trim()}
                className="btn-primary rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                {creating ? <Spinner /> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>}
                Create
              </button>
            </div>
          </div>

          {/* Join by ID */}
          <div className="card rounded-xl p-4">
            <p className="text-xs font-semibold mb-3" style={{ color: '#888' }}>JOIN BY ID</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomIdInput}
                onChange={e => setRoomIdInput(e.target.value.toUpperCase())}
                placeholder="ROOM ID"
                className="input-base flex-1 rounded-lg px-3 py-2 text-sm mono uppercase tracking-widest"
                maxLength={10}
                onKeyDown={e => e.key === 'Enter' && handleJoinById()}
              />
              <button onClick={handleJoinById} disabled={joining || !roomIdInput.trim()}
                className="btn-ghost rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                {joining ? <Spinner /> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>}
                Join
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card rounded-xl p-16 flex items-center justify-center gap-3" style={{ color: '#555' }}>
            <Spinner />
            <span className="text-sm">Loading rooms…</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Owned rooms */}
            <RoomSection
              title="Created by you"
              count={ownedRooms.length}
              empty={{ icon: 'building', text: "You haven't created any rooms yet." }}
              rooms={ownedRooms}
              onJoin={handleJoinExisting}
              editingRoomId={editingRoomId}
              editingRoomName={editingRoomName}
              setEditingRoomId={setEditingRoomId}
              setEditingRoomName={setEditingRoomName}
              onUpdateRoom={handleUpdateRoom}
              onDeleteRoom={handleDeleteRoom}
              deletingRoomId={deletingRoomId}
              showEdit
            />

            {/* Joined rooms */}
            <RoomSection
              title="Joined rooms"
              count={joinedRooms.length}
              empty={{ icon: 'users', text: "You haven't joined any rooms yet." }}
              rooms={joinedRooms}
              onJoin={handleJoinExisting}
              onLeaveRoom={handleLeaveRoom}
              leavingRoomId={leavingRoomId}
              editingRoomId={editingRoomId}
              editingRoomName={editingRoomName}
              setEditingRoomId={setEditingRoomId}
              setEditingRoomName={setEditingRoomName}
              onUpdateRoom={handleUpdateRoom}
              showLeave
            />
          </div>
        )}

        <p className="text-xs text-center pb-4" style={{ color: '#333' }}>Max 6 users per room</p>
      </div>
    </div>
  );
}

function RoomSection({ title, count, empty, rooms, onJoin, editingRoomId, editingRoomName, setEditingRoomId, setEditingRoomName, onUpdateRoom, onDeleteRoom, deletingRoomId, onLeaveRoom, leavingRoomId, showEdit, showLeave }) {
  const Spinner = () => (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );

  return (
    <div className="card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="mono text-xs px-2 py-0.5 rounded" style={{ background: '#1e1e1e', color: '#666', border: '1px solid rgba(255,255,255,0.07)' }}>{count}</span>
      </div>

      {rooms.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm" style={{ color: '#444' }}>{empty.text}</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {rooms.map(room => (
            <div key={room.roomId} className="flex items-center justify-between px-5 py-3.5 t" style={{ '--tw-divide-opacity': 1 }}>
              {editingRoomId === room.roomId ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    value={editingRoomName}
                    onChange={e => setEditingRoomName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') onUpdateRoom(room.roomId, editingRoomName);
                      if (e.key === 'Escape') { setEditingRoomId(null); setEditingRoomName(''); }
                    }}
                    className="input-base flex-1 rounded-lg px-3 py-1.5 text-sm"
                    autoFocus
                  />
                  <button onClick={() => onUpdateRoom(room.roomId, editingRoomName)}
                    className="btn-primary rounded-lg px-3 py-1.5 text-xs">Save</button>
                  <button onClick={() => { setEditingRoomId(null); setEditingRoomName(''); }}
                    className="btn-ghost rounded-lg px-3 py-1.5 text-xs">Cancel</button>
                </div>
              ) : (
                <>
                  <button onClick={() => onJoin(room)} className="flex-1 text-left group min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white group-hover:opacity-70 t truncate">
                        {room.name || room.roomId}
                      </span>
                      <span className="mono text-xs flex-shrink-0" style={{ color: '#444' }}>{room.roomId}</span>
                      {room.full && (
                        <span className="tag flex-shrink-0" style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>Full</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs" style={{ color: '#555' }}>
                        {room.createdAt || room.lastJoinedAt
                          ? new Date(room.createdAt || room.lastJoinedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                          : '—'}
                      </span>
                      <span className="text-xs" style={{ color: '#444' }}>
                        {room.currentUsers}/{room.maxUsers} users
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                    {showEdit && (
                      <button onClick={e => { e.stopPropagation(); setEditingRoomId(room.roomId); setEditingRoomName(room.name || ''); }}
                        className="btn-ghost rounded-lg p-2 t" title="Rename">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                    )}
                    {showEdit && (
                      <button onClick={e => { e.stopPropagation(); onDeleteRoom(room.roomId); }} disabled={deletingRoomId === room.roomId}
                        className="btn-danger rounded-lg p-2 t" title="Delete">
                        {deletingRoomId === room.roomId ? <Spinner /> : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        )}
                      </button>
                    )}
                    {showLeave && (
                      <button onClick={e => { e.stopPropagation(); onLeaveRoom(room.roomId); }} disabled={leavingRoomId === room.roomId}
                        className="btn-ghost rounded-lg p-2 t" title="Leave">
                        {leavingRoomId === room.roomId ? <Spinner /> : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyRooms;

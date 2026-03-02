import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { wsService } from './services/websocket';
import Login from './components/Login';
import Register from './components/Register';
import MyRooms from './components/MyRooms';
import CollaborativeBoard from './components/CollaborativeBoard';

function AppContent() {
  const [showRegister, setShowRegister] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [userName, setUserName] = useState('');
  const [userColor, setUserColor] = useState('');

  const { isAuthenticated, user } = useAuth();

  // FIX: Wire up pagehide so the keepalive REST call fires on tab close/refresh.
  // beforeunload is unreliable (especially on mobile); pagehide is the correct event.
  // We read roomId directly from localStorage instead of React state to avoid
  // stale closure issues — the state value captured at effect registration time
  // may not reflect the room the user is currently in.
  //
  // We also clear activeRoom here so that on the NEXT fresh page load the user
  // is not wrongly blocked by the "already active in another tab" localStorage guard
  // in JoinRoomModal. (On a true tab close the storage stays clear; on refresh it
  // gets cleared and immediately re-set by handleJoinRoom once the board re-mounts.)
  useEffect(() => {
    const handlePageHide = () => {
      const raw = localStorage.getItem('activeRoom');
      if (!raw) return;
      try {
        const { roomId: activeRoomId } = JSON.parse(raw);
        if (activeRoomId) {
          // keepalive fetch — survives page unload, unlike WebSocket DISCONNECT
          wsService.synchronousLeave(activeRoomId);
        }
      } catch (_) {}
      localStorage.removeItem('activeRoom');
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, []); // empty deps: reads localStorage directly, no stale closure risk

  const handleJoinRoom = (roomId, userName, userColor = '') => {
    setRoomId(roomId);
    setUserName(userName);
    setUserColor(userColor);

    if (user?.email) {
      localStorage.setItem(
        'activeRoom',
        JSON.stringify({ roomId, userEmail: user.email }),
      );
    }
  };

  const handleExitRoom = () => {
    setRoomId(null);
    setUserName('');
    setUserColor('');
    localStorage.removeItem('activeRoom');
  };

  if (!isAuthenticated) {
    if (showRegister) {
      return <Register onSwitchToLogin={() => setShowRegister(false)} />;
    }
    return <Login onSwitchToRegister={() => setShowRegister(true)} />;
  }

  return (
    <div
      className={
        roomId
          ? 'h-screen w-screen overflow-hidden bg-slate-900'
          : 'h-screen w-screen overflow-y-auto overflow-x-hidden bg-slate-900'
      }
    >
      {!roomId ? (
        <MyRooms onJoinRoom={handleJoinRoom} />
      ) : (
        <CollaborativeBoard
          roomId={roomId}
          userName={userName || user.name}
          userColor={userColor}
          onExit={handleExitRoom}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
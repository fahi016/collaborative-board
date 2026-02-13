import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import JoinRoomModal from './components/JoinRoomModal';
import CollaborativeBoard from './components/CollaborativeBoard';

function AppContent() {
  const [showRegister, setShowRegister] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [userName, setUserName] = useState('');
  const [userColor, setUserColor] = useState('');

  const { isAuthenticated, user } = useAuth();

  const handleJoinRoom = (roomId, userName, userColor) => {
    setRoomId(roomId);
    setUserName(userName);
    setUserColor(userColor);

    // Track active room per user in localStorage so that
    // other tabs can prevent joining another room with
    // the same authenticated user.
    if (user?.email) {
      localStorage.setItem(
        'activeRoom',
        JSON.stringify({
          roomId,
          userEmail: user.email,
        }),
      );
    }
  };

  const handleExitRoom = () => {
    setRoomId(null);
    setUserName('');
    setUserColor('');

    // Clear active room marker for this browser
    localStorage.removeItem('activeRoom');
  };

  // Show login/register if not authenticated
  if (!isAuthenticated) {
    if (showRegister) {
      return <Register onSwitchToLogin={() => setShowRegister(false)} />;
    }
    return <Login onSwitchToRegister={() => setShowRegister(true)} />;
  }

  // Show board or room selection if authenticated
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100">
      {!roomId ? (
        <JoinRoomModal
          onJoinRoom={handleJoinRoom}
        />
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
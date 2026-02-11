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
  const [sessionId, setSessionId] = useState('');
  const [userColor, setUserColor] = useState('');

  const { isAuthenticated, user } = useAuth();

  const generateSessionId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Generate session ID on first mount
  useEffect(() => {
    const storedSessionId = sessionStorage.getItem('sessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = generateSessionId();
      sessionStorage.setItem('sessionId', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

  const handleJoinRoom = (roomId, userName, userColor) => {
    setRoomId(roomId);
    setUserName(userName);
    setUserColor(userColor);
  };

  const handleExitRoom = () => {
    setRoomId(null);
    setUserName('');
    setUserColor('');
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
          sessionId={sessionId}
        />
      ) : (
        <CollaborativeBoard
          roomId={roomId}
          userName={userName || user.name}
          userColor={userColor}
          sessionId={sessionId}
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
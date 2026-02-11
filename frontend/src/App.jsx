// src/App.jsx
import { useState } from 'react';
import JoinRoomModal from './components/JoinRoomModal';
import CollaborativeBoard from './components/CollaborativeBoard';

function App() {
  const [roomId, setRoomId] = useState(null);
  const [userName, setUserName] = useState('');
  const [userColor, setUserColor] = useState('');

  const handleJoinRoom = (roomId, userName) => {
    setRoomId(roomId);
    setUserName(userName);
    setUserColor('#000000'); // or assign later via WS if needed
  };

  const handleExitRoom = () => {
    setRoomId(null);
    setUserName('');
    setUserColor('');
  };

  return (
    <div className="h-screen w-screen">
      {!roomId ? (
        <JoinRoomModal onJoinRoom={handleJoinRoom} />
      ) : (
        <CollaborativeBoard
          roomId={roomId}
          userName={userName}
          userColor={userColor}
          onExit={handleExitRoom}
        />
      )}
    </div>
  );
}

export default App;

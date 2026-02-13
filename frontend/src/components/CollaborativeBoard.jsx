// src/components/CollaborativeBoard.jsx
import { useState, useEffect, useRef } from 'react';
import TopBar from './TopBar';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
import UserList from './UserList';
import { wsService } from '../services/websocket';
import { api } from '../services/api';

function CollaborativeBoard({ roomId, userName, userColor, onExit }) {
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [users, setUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    let active = true;

    // 1️⃣ Connect WebSocket
    wsService.connect(() => {
      if (!active) return;

      setConnected(true);

      // 2️⃣ SUBSCRIBE before sending join
      // History queue (per-user)
      wsService.subscribe('/user/queue/history', handleHistoryMessage);

      // BOARD EVENTS
      wsService.subscribe(`/topic/room/${roomId}`, handleRemoteAction);

      // USER PRESENCE EVENTS
      wsService.subscribe(`/topic/room/${roomId}/users`, handleUserUpdate);

      // 3️⃣ JOIN ROOM (WebSocket-only presence)
      wsService.joinRoom(roomId, { userName });
    });

    // 3️⃣ Handle tab close / refresh
    const handleBeforeUnload = () => {
      wsService.leaveRoom(roomId, { userName });
      wsService.disconnect();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      active = false;
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomId, userName]);

  const handleHistoryMessage = (rawMessage) => {
    if (!canvasRef.current || !rawMessage) return;

    let historyPayload = rawMessage;

    // Our wsService.subscribe already JSON.parses msg.body,
    // but backend might send a JSON string; handle both safely.
    try {
      if (typeof historyPayload === 'string') {
        historyPayload = JSON.parse(historyPayload);
      }
    } catch (e) {
      try {
        historyPayload = JSON.parse(historyPayload);
      } catch (e2) {
        console.error('Failed to parse history payload', e2);
        return;
      }
    }

    if (Array.isArray(historyPayload)) {
      historyPayload.forEach((action) => {
        canvasRef.current.applyRemoteAction(action);
      });
    }
  };

  const handleRemoteAction = (message) => {
    if (canvasRef.current) {
      canvasRef.current.applyRemoteAction(message);
    }
  };

  const handleUserUpdate = (message) => {
    if (message.type === 'user-list') {
      setUsers(message.users || []);
    }
  };

  const handleAction = (action) => {
    wsService.send(`/app/board/${roomId}/${action.type}`, {
      type: action.type,
      userName,
      data: action.data,
    });
  };

  const handleExit = () => {
    wsService.leaveRoom(roomId, { userName });
    wsService.disconnect();
    onExit();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      <TopBar
        roomId={roomId}
        userName={userName}
        onExit={handleExit}
        connected={connected}
      />

      <div className="flex-1 flex overflow-hidden">
        <Toolbar
          tool={tool}
          color={color}
          onToolChange={setTool}
          onColorChange={setColor}
        />

        <div className="flex-1 flex flex-col">
          <Canvas
            ref={canvasRef}
            tool={tool}
            color={color}
            userColor={userColor}
            onAction={handleAction}
          />

          <div className="bg-white border-t px-4 py-2">
            <UserList users={users} currentUser={userName} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CollaborativeBoard;

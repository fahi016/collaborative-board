// src/components/CollaborativeBoard.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import TopBar from './TopBar';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
import UserList from './UserList';
import { wsService } from '../services/websocket';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

function CollaborativeBoard({ roomId, userName, userColor, onExit }) {
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [users, setUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const canvasRef = useRef(null);
  const { showToast } = useToast();

  const handleHistoryMessage = useCallback((rawMessage) => {
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
  }, []);

  const handleRemoteAction = useCallback((message) => {
    if (!message || !message.type || !message.data) {
      console.warn('Ignoring malformed board action message', message);
      return;
    }
    if (canvasRef.current) {
      canvasRef.current.applyRemoteAction(message);
    }
  }, []);

  const handleUserUpdate = useCallback((message) => {
    if (!message || message.type !== 'user-list') return;
    if (!Array.isArray(message.users)) {
      console.warn('Ignoring malformed user list message', message);
      return;
    }
    setUsers(message.users);
  }, []);

  const handleAction = useCallback(
    (action) => {
      if (!action || !action.type || !action.data) {
        return;
      }
      wsService.send(`/app/board/${roomId}/${action.type}`, {
        type: action.type,
        userId: userName,
        userName,
        timestamp: Date.now(),
        data: action.data,
      });
    },
    [roomId, userName],
  );

  const handleExit = useCallback(() => {
    wsService.leaveRoom(roomId, { userName });
    wsService.disconnect();
    onExit();
  }, [roomId, userName, onExit]);

  useEffect(() => {
    let active = true;

    // 1️⃣ Connect WebSocket
    wsService.connect(
      () => {
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
      },
      (errorBody) => {
        console.error('WebSocket/STOMP error while joining room:', errorBody);

        const defaultMsg =
          'You are already active in another room in a different tab. Please close that tab and try again.';
        const msgFromServer =
          typeof errorBody === 'string' && errorBody.trim().length > 0
            ? errorBody
            : defaultMsg;

        showToast(msgFromServer, 'error');

        setConnected(false);
        onExit();
      },
    );

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
  }, [roomId, userName, showToast, handleHistoryMessage, handleRemoteAction, handleUserUpdate, onExit]);

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

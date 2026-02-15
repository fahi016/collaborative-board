// src/components/CollaborativeBoard.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import TopBar from './TopBar';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
import UserList from './UserList';
import ChatPanel from './ChatPanel';
import { wsService } from '../services/websocket';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useVoiceRoom } from '../hooks/useVoiceRoom';

function CollaborativeBoard({ roomId, userName, userColor, onExit }) {
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [users, setUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [roomName, setRoomName] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceMicState, setVoiceMicState] = useState({});

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const canvasRef = useRef(null);
  const { showToast } = useToast();

  const [mySessionId, setMySessionId] = useState(null);

  const sendVoiceSignal = useCallback(
    (payload) => {
      wsService.sendVoiceSignal(roomId, payload);
    },
    [roomId],
  );

  const {
    startVoice,
    leaveVoice,
    setMuted: setVoiceMuted,
    handleIncomingSignal: handleIncomingVoiceSignal,
  } = useVoiceRoom(roomId, users, userName, mySessionId, sendVoiceSignal);

  const handleHistoryMessage = useCallback((rawMessage) => {
    if (!canvasRef.current || !rawMessage) return;

    let historyPayload = rawMessage;

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
    if (!message || !message.type) return;
    if (message.type === 'user-list') {
      if (!Array.isArray(message.users)) {
        console.warn('Ignoring malformed user list message', message);
        return;
      }
      setUsers(message.users);
      // Fallback: set our sessionId from user list if not set yet (e.g. join-confirmation missed)
      setMySessionId((prev) => {
        if (prev) return prev;
        const me = message.users.find((u) => u.userName === userName);
        return me?.sessionId ?? null;
      });
    } else if (message.type === 'voice-mic') {
      setVoiceMicState((prev) => ({
        ...prev,
        [message.sessionId]: message.muted,
      }));
    }
  }, [userName]);

  const handleChatMessage = useCallback((message) => {
    if (!message || !message.id) {
      console.warn('Ignoring malformed chat message', message);
      return;
    }

    console.log('💬 Chat message received:', message);

    setChatMessages((prev) => {
      // Avoid duplicates
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });

    // Increment unread count if chat is closed
    if (!chatOpen && message.senderName !== userName) {
      setUnreadCount((prev) => prev + 1);
    }
  }, [chatOpen, userName]);

  const handleRoomUpdate = useCallback((message) => {
    if (!message || message.type !== 'room_update') return;

    if (message.event === 'updated' && message.roomName) {
      setRoomName(message.roomName);
      showToast(`Room name updated to "${message.roomName}"`, 'info');
    } else if (message.event === 'deleted') {
      showToast('This room has been deleted by the owner', 'error');
      setTimeout(() => {
        onExit();
      }, 2000);
    }
  }, [showToast, onExit]);

  const handlersRef = useRef({});
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  const handleError = useCallback((message) => {
    if (!message || message.type !== 'error') return;

    const errorMsg = message.message || message.details || 'An error occurred';
    showToast(errorMsg, 'error');

    if (message.roomId === roomId) {
      setTimeout(() => {
        onExit();
      }, 3000);
    }
  }, [roomId, showToast, onExit]);

  handlersRef.current = {
    handleHistoryMessage,
    handleRemoteAction,
    handleUserUpdate,
    handleRoomUpdate,
    handleError,
    handleIncomingVoiceSignal,
    handleChatMessage,
  };

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

  const handleSendChatMessage = useCallback(async (content) => {
    wsService.sendChatMessage(roomId, content);
  }, [roomId]);

  const handleToggleChat = useCallback(() => {
    setChatOpen((prev) => !prev);
    // Reset unread count when opening chat
    if (!chatOpen) {
      setUnreadCount(0);
    }
  }, [chatOpen]);

  const handleJoinVoice = useCallback(async () => {
    if (!mySessionId) {
      showToast('Please wait for connection to be fully established', 'warning');
      return;
    }

    try {
      await startVoice();
      setVoiceEnabled(true);
      wsService.sendVoiceMic(roomId, false);
      showToast('Voice joined', 'success');
    } catch (err) {
      console.error('Failed to start voice', err);
      showToast(err?.message || 'Could not start microphone', 'error');
    }
  }, [roomId, mySessionId, startVoice, showToast]);

  const handleLeaveVoice = useCallback(() => {
    leaveVoice();
    setVoiceEnabled(false);
    setMuted(false);
    setVoiceMicState({});
    showToast('Voice left', 'info');
  }, [leaveVoice, showToast]);

  const handleMicToggle = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setVoiceMuted(next);
    wsService.sendVoiceMic(roomId, next);
  }, [roomId, muted, setVoiceMuted]);

  const handleExit = useCallback(() => {
    if (voiceEnabled) leaveVoice();
    wsService.leaveRoom(roomId, { userName });
    wsService.disconnect();
    onExit();
  }, [roomId, userName, voiceEnabled, leaveVoice, onExit]);

  // Fetch room info on mount
  useEffect(() => {
    const fetchRoomInfo = async () => {
      try {
        const info = await api.getRoomInfo(roomId);
        setRoomName(info.name || null);
      } catch (err) {
        console.error('Failed to fetch room info:', err);
      }
    };
    fetchRoomInfo();
  }, [roomId]);

  // Load chat history when opening chat
  useEffect(() => {
    if (chatOpen && chatMessages.length === 0) {
      const loadHistory = async () => {
        try {
          const response = await api.getChatHistory(roomId, 0, 50);
          if (response.content && response.content.length > 0) {
            // Messages come in DESC order, reverse them for chronological display
            const reversedMessages = [...response.content].reverse();
            setChatMessages(reversedMessages);
          }
        } catch (error) {
          console.error('Failed to load chat history:', error);
        }
      };
      loadHistory();
    }
  }, [chatOpen, roomId, chatMessages.length]);

  useEffect(() => {
    let active = true;

    // 1️⃣ Connect WebSocket
    wsService.connect(
      () => {
        if (!active) return;

        setConnected(true);

        // 2️⃣ SUBSCRIBE before sending join

        wsService.subscribe('/user/queue/join-confirmation', (msg) => {
          if (msg?.sessionId) setMySessionId(msg.sessionId);
        });

        // History queue (per-user)
        wsService.subscribe('/user/queue/history', (msg) => handlersRef.current.handleHistoryMessage?.(msg));

        // BOARD EVENTS
        wsService.subscribe(`/topic/room/${roomId}`, (msg) => handlersRef.current.handleRemoteAction?.(msg));

        // USER PRESENCE EVENTS
        wsService.subscribe(`/topic/room/${roomId}/users`, (msg) => handlersRef.current.handleUserUpdate?.(msg));

        // ROOM UPDATE EVENTS
        wsService.subscribe(`/topic/room/${roomId}/updates`, (msg) => handlersRef.current.handleRoomUpdate?.(msg));

        // ERROR MESSAGES (per-user queue)
        wsService.subscribe('/user/queue/errors', (msg) => handlersRef.current.handleError?.(msg));

        // VOICE: WebRTC signaling (per-user queue)
        wsService.subscribe('/user/queue/voice-signal', (msg) => handlersRef.current.handleIncomingVoiceSignal?.(msg));

        // CHAT: Room chat messages
        wsService.subscribe(`/topic/room/${roomId}/chat`, (msg) => handlersRef.current.handleChatMessage?.(msg));

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
        onExitRef.current?.();
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
  }, [roomId, userName, showToast]);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      {/* Remote voice streams (hidden; audio only) */}
      {voiceEnabled &&
        users
          .filter((u) => u.sessionId !== mySessionId)
          .map((u) => (
            <audio
              key={u.sessionId}
              id={`remote-audio-${u.sessionId}`}
              autoPlay
              playsInline
              className="hidden"
              aria-label={`Remote audio ${u.userName}`}
            />
          ))}

      <TopBar
        roomId={roomId}
        roomName={roomName}
        userName={userName}
        onExit={handleExit}
        connected={connected}
        voiceEnabled={voiceEnabled}
        onJoinVoice={handleJoinVoice}
        muted={muted}
        onMicToggle={handleMicToggle}
        onToggleChat={handleToggleChat}
        chatOpen={chatOpen}
        unreadCount={unreadCount}
      />

      <div className="flex-1 flex overflow-hidden relative">
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
            <UserList
              users={users}
              currentUser={userName}
              mySessionId={mySessionId}
              voiceMicState={voiceMicState}
              voiceEnabled={voiceEnabled}
            />
          </div>
        </div>

        {/* Chat Panel - Overlay on right side */}
        <ChatPanel
          roomId={roomId}
          currentUser={userName}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={chatMessages}
          onSendMessage={handleSendChatMessage}
        />
      </div>
    </div>
  );
}

export default CollaborativeBoard;
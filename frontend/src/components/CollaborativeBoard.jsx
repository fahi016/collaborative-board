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
import { logger } from '../utils/logger';

function CollaborativeBoard({ roomId, userName, userColor, onExit }) {
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#ffffff');
  const [eraserSize, setEraserSize] = useState(20);
  const [users, setUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [roomName, setRoomName] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceMicState, setVoiceMicState] = useState({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const canvasRef = useRef(null);
  const { showToast } = useToast();
  const [mySessionId, setMySessionId] = useState(null);
  const reconnectNoticeShownRef = useRef(false);

  const sendVoiceSignal = useCallback(payload => wsService.sendVoiceSignal(roomId, payload), [roomId]);
  const {
    startVoice,
    leaveVoice,
    setMuted: setVoiceMuted,
    handleIncomingSignal: handleIncomingVoiceSignal,
    autoplayBlocked,
    enableAudioPlayback,
  } = useVoiceRoom(roomId, users, mySessionId, sendVoiceSignal);

  const handleHistoryMessage = useCallback((rawMessage) => {
    if (!canvasRef.current || !rawMessage) return;
    let payload = rawMessage;
    try { if (typeof payload === 'string') payload = JSON.parse(payload); } catch (e) { return; }
    if (Array.isArray(payload)) payload.forEach(action => canvasRef.current.applyRemoteAction(action));
  }, []);

  const handleRemoteAction = useCallback((message) => {
    if (!message || !message.type || !message.data) return;
    canvasRef.current?.applyRemoteAction(message);
  }, []);

  const handleUserUpdate = useCallback((message) => {
    if (!message || !message.type) return;
    if (message.type === 'user-list') {
      if (!Array.isArray(message.users)) return;
      setUsers(message.users);
      setMySessionId(prev => {
        if (prev) return prev;
        return message.users.find(u => u.userName === userName)?.sessionId ?? null;
      });
    } else if (message.type === 'voice-mic') {
      setVoiceMicState(prev => ({
        ...prev,
        ...(message.sessionId ? { [message.sessionId]: message.muted } : {}),
        ...(message.userName ? { [`user:${message.userName}`]: message.muted } : {}),
      }));
    }
  }, [userName]);

  const handleChatMessage = useCallback((message) => {
    if (!message || !message.id) return;
    setChatMessages(prev => prev.some(m => m.id === message.id) ? prev : [...prev, message]);
    if (!chatOpen && message.senderName !== userName) setUnreadCount(prev => prev + 1);
  }, [chatOpen, userName]);

  const handleRoomUpdate = useCallback((message) => {
    if (!message || message.type !== 'room_update') return;
    if (message.event === 'updated' && message.roomName) {
      setRoomName(message.roomName);
      showToast(`Room renamed to "${message.roomName}"`, 'info');
    } else if (message.event === 'deleted') {
      showToast('Room was deleted', 'error');
      setTimeout(() => onExit(), 2000);
    }
  }, [showToast, onExit]);

  const handlersRef = useRef({});
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  const handleError = useCallback((message) => {
    if (!message || message.type !== 'error') return;
    showToast(message.message || message.details || 'An error occurred', 'error');
    if (message.roomId === roomId) setTimeout(() => onExit(), 3000);
  }, [roomId, showToast, onExit]);

  handlersRef.current = {
    handleHistoryMessage, handleRemoteAction, handleUserUpdate,
    handleRoomUpdate, handleError, handleIncomingVoiceSignal, handleChatMessage,
  };

  const handleAction = useCallback((action) => {
    if (!action || !action.type || !action.data) return;
    wsService.send(`/app/board/${roomId}/${action.type}`, {
      type: action.type, userId: userName, userName, timestamp: Date.now(), data: action.data,
    });
  }, [roomId, userName]);

  const handleSendChatMessage = useCallback(async (content) => {
    wsService.sendChatMessage(roomId, content);
  }, [roomId]);

  const handleToggleChat = useCallback(() => {
    setChatOpen(prev => !prev);
    if (!chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  const handleJoinVoice = useCallback(async () => {
    if (!mySessionId) { showToast('Please wait, connecting...', 'warning'); return; }
    try {
      await startVoice();
      setVoiceEnabled(true);
      wsService.sendVoiceMic(roomId, false);
      showToast('Voice joined', 'success');
    } catch (err) {
      showToast(err?.message || 'Could not start microphone', 'error');
    }
  }, [roomId, mySessionId, startVoice, showToast]);

  const handleMicToggle = useCallback(() => {
    const next = !muted;
    setMuted(next); setVoiceMuted(next); wsService.sendVoiceMic(roomId, next);
  }, [roomId, muted, setVoiceMuted]);

  const handleEnableAudio = useCallback(async () => {
    const ok = await enableAudioPlayback();
    if (ok) {
      showToast('Audio playback enabled', 'success');
    } else {
      showToast('Browser still blocked audio. Click again after interacting with the page.', 'warning');
    }
  }, [enableAudioPlayback, showToast]);

  const handleExit = useCallback(() => {
    if (voiceEnabled) leaveVoice();
    wsService.leaveRoom(roomId, { userName });
    wsService.disconnect();
    onExit();
  }, [roomId, userName, voiceEnabled, leaveVoice, onExit]);

  useEffect(() => {
    (async () => {
      try { const info = await api.getRoomInfo(roomId); setRoomName(info.name || null); }
      catch (err) { logger.error('Failed to fetch room info:', err); }
    })();
  }, [roomId]);

  useEffect(() => {
    if (chatOpen && chatMessages.length === 0) {
      (async () => {
        try {
          const response = await api.getChatHistory(roomId, 0, 50);
          if (response.content?.length > 0)
            setChatMessages([...response.content].reverse());
        } catch (error) { logger.error('Failed to load chat history:', error); }
      })();
    }
  }, [chatOpen, roomId, chatMessages.length]);

  useEffect(() => {
    let active = true;
    wsService.connect(
      () => {
        if (!active) return;
        reconnectNoticeShownRef.current = false;
        setConnected(true);
        let roomTopicsSubscribed = false;
        const subscribeRoomTopics = () => {
          if (roomTopicsSubscribed) return;
          roomTopicsSubscribed = true;
          wsService.subscribe(`/topic/room/${roomId}`, msg => handlersRef.current.handleRemoteAction?.(msg));
          wsService.subscribe(`/topic/room/${roomId}/users`, msg => handlersRef.current.handleUserUpdate?.(msg));
          wsService.subscribe(`/topic/room/${roomId}/updates`, msg => handlersRef.current.handleRoomUpdate?.(msg));
          wsService.subscribe(`/topic/room/${roomId}/chat`, msg => handlersRef.current.handleChatMessage?.(msg));
        };

        // Subscribe topics before JOIN to avoid missing the first user-list broadcast.
        subscribeRoomTopics();

        wsService.subscribe('/user/queue/join-confirmation', msg => {
          if (msg?.sessionId) {
            setMySessionId(msg.sessionId);
            (async () => {
              try {
                const activeUsers = await api.getActiveUsers(roomId);
                if (!active) return;
                setUsers((prev) => {
                  const byName = new Map(prev.map((u) => [u.userName, u.sessionId]));
                  return Array.isArray(activeUsers)
                    ? activeUsers.map((u) => ({
                        userName: u.userName,
                        color: u.color,
                        sessionId: u.sessionId ?? byName.get(u.userName) ?? null,
                      }))
                    : prev;
                });
              } catch (err) {
                logger.error('Failed to sync active users after join:', err);
              }
            })();
          }
        });
        wsService.subscribe('/user/queue/history', msg => handlersRef.current.handleHistoryMessage?.(msg));
        wsService.subscribe('/user/queue/errors', msg => handlersRef.current.handleError?.(msg));
        wsService.subscribe('/user/queue/voice-signal', msg => handlersRef.current.handleIncomingVoiceSignal?.(msg));
        wsService.joinRoom(roomId, { userName });
      },
      (errorBody) => {
        const msg = typeof errorBody === 'string' && errorBody.trim() ? errorBody : 'Already active in another tab.';
        showToast(msg, 'error');
        setConnected(false);
        onExitRef.current?.();
      },
      () => {
        if (!active) return;
        setConnected(false);
        if (!reconnectNoticeShownRef.current) {
          reconnectNoticeShownRef.current = true;
          showToast('Connection lost. Reconnecting...', 'warning');
        }
      },
    );

    // FIX: Use pagehide instead of (or in addition to) beforeunload.
    // pagehide fires more reliably on mobile and for bfcache navigations.
    // Use synchronousLeave (fetch with keepalive:true) instead of wsService.disconnect()
    // because client.deactivate() is async and the browser kills it before the
    // STOMP DISCONNECT frame is sent — the server never receives it.
    const handlePageHide = () => {
      wsService.synchronousLeave(roomId, userName);
    };

    const handleBeforeUnload = () => {
      wsService.synchronousLeave(roomId, userName);
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      active = false;
      // Normal React unmount (user clicked Exit) — use proper WS leave
      wsService.leaveRoom(roomId, { userName });
      wsService.disconnect();
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomId, userName, showToast]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: '#0a0a0a' }}>
      <TopBar
        roomId={roomId} roomName={roomName} userName={userName} onExit={handleExit}
        connected={connected} voiceEnabled={voiceEnabled} onJoinVoice={handleJoinVoice}
        muted={muted} onMicToggle={handleMicToggle} onToggleChat={handleToggleChat}
        chatOpen={chatOpen} unreadCount={unreadCount}
      />

      {autoplayBlocked && (
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ background: '#16120a', borderColor: 'rgba(245,158,11,0.25)' }}>
          <span className="text-xs" style={{ color: '#fbbf24' }}>
            Audio is blocked by browser autoplay policy.
          </span>
          <button
            onClick={handleEnableAudio}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold t"
            style={{ background: '#fbbf24', color: '#0a0a0a' }}
          >
            Enable audio
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          tool={tool} color={color} eraserSize={eraserSize}
          onToolChange={setTool} onColorChange={setColor} onEraserSizeChange={setEraserSize}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Canvas
            ref={canvasRef} tool={tool} color={color} eraserSize={eraserSize}
            userColor={userColor} onAction={handleAction}
          />
          <div className="flex-shrink-0 px-4 py-2.5 border-t" style={{ background: '#0a0a0a', borderColor: 'rgba(255,255,255,0.07)' }}>
            <UserList
              users={users} currentUser={userName} mySessionId={mySessionId}
              voiceMicState={voiceMicState} voiceEnabled={voiceEnabled}
            />
          </div>
        </div>
      </div>

      <ChatPanel
        roomId={roomId} currentUser={userName} isOpen={chatOpen}
        onClose={() => setChatOpen(false)} messages={chatMessages} onSendMessage={handleSendChatMessage}
      />
    </div>
  );
}

export default CollaborativeBoard;

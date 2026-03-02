// src/components/TopBar.jsx
import { useToast } from '../context/ToastContext';

function TopBar({ roomId, roomName, userName, onExit, connected, voiceEnabled, onJoinVoice, muted, onMicToggle, onToggleChat, chatOpen, unreadCount = 0 }) {
  const { showToast } = useToast();

  const copyRoomId = async () => {
    try { await navigator.clipboard.writeText(roomId); showToast('Room ID copied', 'success'); }
    catch { showToast('Failed to copy', 'error'); }
  };

  return (
    <header className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0" style={{ background: '#0a0a0a', borderColor: 'rgba(255,255,255,0.07)' }}>
      {/* Left: logo + room */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: '#fff' }}>
            <svg className="w-3.5 h-3.5" fill="#0a0a0a" viewBox="0 0 24 24"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 5h2v-2h2v2h2v2h-2v2h-2v-2h-2v-2z"/></svg>
          </div>
          <span className="text-xs font-bold text-white hidden sm:block">Collab Board</span>
        </div>

        <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>

        <button onClick={copyRoomId} className="flex items-center gap-1.5 t hover:opacity-70 min-w-0" title="Click to copy room ID">
          <span className="text-xs truncate" style={{ color: '#888' }}>{roomName || 'Untitled'}</span>
          <span className="mono text-xs flex-shrink-0" style={{ color: '#555' }}>{roomId}</span>
        </button>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'dot-live' : 'dot-offline'}`} />
          <span className="text-xs hidden sm:block" style={{ color: connected ? '#4ade80' : '#f87171' }}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Chat */}
        {onToggleChat && (
          <button onClick={onToggleChat} title="Toggle chat"
            className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium t ${
              chatOpen
                ? 'text-white'
                : 'btn-ghost'
            }`}
            style={chatOpen ? { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' } : {}}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd"/>
            </svg>
            <span className="hidden sm:inline">Chat</span>
            {!chatOpen && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{ background: '#ef4444', color: '#fff' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Voice */}
        {onJoinVoice && !voiceEnabled ? (
          <button onClick={onJoinVoice}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium t btn-ghost">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/>
            </svg>
            <span className="hidden sm:inline">Voice</span>
          </button>
        ) : onMicToggle && voiceEnabled ? (
          <button onClick={onMicToggle} title={muted ? 'Unmute' : 'Mute'}
            className={`flex items-center justify-center rounded-lg w-8 h-8 t ${muted ? 'btn-ghost' : ''}`}
            style={!muted ? { background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' } : {}}>
            {muted ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.076L5.207 12.3 2.293 15.207a1 1 0 01-1.414-1.414l14-14a1 1 0 011.414 1.414L9.383 3.076z" clipRule="evenodd"/>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/>
              </svg>
            )}
          </button>
        ) : null}

        {/* User chip */}
        <div className="hidden lg:flex items-center rounded-lg px-2.5 py-1" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-xs" style={{ color: '#888' }}>{userName}</span>
        </div>

        {/* Exit */}
        <button onClick={onExit} className="btn-danger rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
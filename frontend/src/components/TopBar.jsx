// src/components/TopBar.jsx
import { useToast } from '../context/ToastContext';

function MicIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.076L5.207 12.3 2.293 15.207a1 1 0 01-1.414-1.414l14-14a1 1 0 011.414 1.414L9.383 3.076zM11 5.414l2.586 2.586A3 3 0 0113 8V4a1 1 0 012 0v4a5 5 0 00.93 2.88l1.453 1.453A7 7 0 0017 8a1 1 0 10-2 0 5 5 0 01-.93 2.88L11 5.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TopBar({
  roomId,
  roomName,
  userName,
  onExit,
  connected,
  voiceEnabled,
  onJoinVoice,
  muted,
  onMicToggle,

  // ✅ Chat props added
  onToggleChat,
  chatOpen,
  unreadCount = 0,
}) {
  const { showToast } = useToast();

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      showToast(`Room ID ${roomId} copied to clipboard!`, 'success');
    } catch (e) {
      showToast('Failed to copy Room ID', 'error');
    }
  };

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between shadow-elevation-1">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-elevation-1">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Collaborative Board</h1>
            {roomName && (
              <p className="text-xs text-slate-400 mt-0.5">{roomName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700/50 rounded-lg border border-slate-600">
            <span className="text-xs font-medium text-slate-400">Room ID:</span>
            <button
              onClick={copyRoomId}
              className="font-mono font-bold text-blue-400 hover:text-blue-300 text-sm transition-colors flex items-center space-x-1"
              title="Click to copy"
            >
              <span>{roomId}</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700/50 rounded-lg border border-slate-600">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            <span className="text-xs font-medium text-slate-300">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Chat Toggle Button */}
        {onToggleChat && (
          <button
            type="button"
            onClick={onToggleChat}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl transition-smooth text-sm font-semibold ${
              chatOpen
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-elevation-2'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title={chatOpen ? 'Close chat' : 'Open chat'}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden sm:inline">Chat</span>

            {/* Unread Badge */}
            {!chatOpen && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-xs font-bold text-white bg-red-500 rounded-full shadow-elevation-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Voice controls */}
        {onJoinVoice && !voiceEnabled ? (
          <button
            type="button"
            onClick={onJoinVoice}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl transition-smooth text-sm font-semibold shadow-elevation-1 hover:shadow-elevation-2"
            title="Join voice"
          >
            <MicIcon />
            <span className="hidden sm:inline">Join Voice</span>
          </button>
        ) : onMicToggle && voiceEnabled ? (
          <button
            type="button"
            onClick={onMicToggle}
            className={`flex items-center justify-center p-2.5 rounded-xl transition-smooth shadow-elevation-1 hover:shadow-elevation-2 ${
              muted
                ? 'bg-slate-600 hover:bg-slate-500 text-white'
                : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white'
            }`}
            title={muted ? 'Unmute' : 'Mute'}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOffIcon /> : <MicIcon />}
          </button>
        ) : null}

        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-700/50 rounded-lg border border-slate-600">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs font-medium text-slate-300">
            {userName}
          </span>
        </div>

        <button
          onClick={onExit}
          className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl transition-smooth text-sm font-semibold shadow-elevation-1 hover:shadow-elevation-2 flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>
    </div>
  );
}

export default TopBar;

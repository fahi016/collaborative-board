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
    <div className="bg-white border-b border-gray-300 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-6">
        <h1 className="text-xl font-bold text-gray-800">Collaborative Board</h1>

        <div className="flex items-center space-x-3">
          {roomName && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Room:</span>
              <span className="text-sm font-semibold text-gray-800">{roomName}</span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">ID:</span>
            <button
              onClick={copyRoomId}
              className="font-mono font-bold text-blue-600 hover:text-blue-700 px-3 py-1 bg-blue-50 rounded hover:bg-blue-100 transition text-sm"
            >
              {roomId}
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-600">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-4">

        {/* ✅ Chat Toggle Button */}
        {onToggleChat && (
          <button
            type="button"
            onClick={onToggleChat}
            className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm font-medium ${
              chatOpen
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
            Chat

            {/* ✅ Unread Badge */}
            {!chatOpen && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Voice controls (unchanged) */}
        {onJoinVoice && !voiceEnabled ? (
          <button
            type="button"
            onClick={onJoinVoice}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition text-sm font-medium"
            title="Join voice"
          >
            <MicIcon />
            Join voice
          </button>
        ) : onMicToggle && voiceEnabled ? (
          <button
            type="button"
            onClick={onMicToggle}
            className={`flex items-center justify-center p-2 rounded-lg transition ${
              muted
                ? 'bg-gray-400 hover:bg-gray-500 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
            title={muted ? 'Unmute' : 'Mute'}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOffIcon /> : <MicIcon />}
          </button>
        ) : null}

        <span className="text-sm text-gray-700">
          Logged in as: <span className="font-medium">{userName}</span>
        </span>

        <button
          onClick={onExit}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition text-sm font-medium"
        >
          Exit Room
        </button>
      </div>
    </div>
  );
}

export default TopBar;

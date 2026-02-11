// src/components/TopBar.jsx
import { useToast } from '../context/ToastContext';

function TopBar({ roomId, userName, onExit, connected }) {
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
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Room ID:</span>
          <button
            onClick={copyRoomId}
            className="font-mono font-bold text-blue-600 hover:text-blue-700 px-3 py-1 bg-blue-50 rounded hover:bg-blue-100 transition"
          >
            {roomId}
          </button>
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
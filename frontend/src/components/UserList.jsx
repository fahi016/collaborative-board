// src/components/UserList.jsx
function MicIndicator({ muted }) {
  const isMuted = muted === true;
  return (
    <span className="ml-1" title={isMuted ? 'Muted' : 'Speaking'}>
      {isMuted ? (
        <svg className="w-3.5 h-3.5 text-gray-400 inline" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.076L5.207 12.3 2.293 15.207a1 1 0 01-1.414-1.414l14-14a1 1 0 011.414 1.414L9.383 3.076z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-emerald-600 inline" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </span>
  );
}

function UserList({ users, currentUser, mySessionId, voiceMicState = {}, voiceEnabled = false }) {
  const isMutedFor = (sessionId) => {
    if (!(sessionId in voiceMicState)) return undefined;
    return voiceMicState[sessionId];
  };

  return (
    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
      <span className="text-sm text-gray-600">Online:</span>
      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
        {users.map((user, index) => {
          const isYou = user.userName === currentUser;
          const muted = isMutedFor(user.sessionId);
          const showMic = voiceEnabled;
          return (
            <div
              key={user.sessionId || index}
              className="flex items-center space-x-1 px-3 py-1 bg-gray-100 rounded-full"
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: user.color || '#888' }}
              />
              <span className="text-sm font-medium text-gray-700">
                {user.userName}
                {isYou && ' (You)'}
              </span>
              {showMic && <MicIndicator muted={muted} />}
            </div>
          );
        })}
      </div>
      <span className="text-sm text-gray-500">
        ({users.length}/3)
      </span>
    </div>
  );
}

export default UserList;
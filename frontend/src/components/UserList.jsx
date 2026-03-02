// src/components/UserList.jsx
function MicIndicator({ muted }) {
  const isMuted = muted === true;
  return (
    <span title={isMuted ? 'Muted' : 'Live mic'}>
      {isMuted ? (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#ef4444' }}>
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.076L5.207 12.3 2.293 15.207a1 1 0 01-1.414-1.414l14-14a1 1 0 011.414 1.414L9.383 3.076z" clipRule="evenodd"/>
        </svg>
      ) : (
        <svg className="w-3 h-3 animate-pulse" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#4ade80' }}>
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/>
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
    <div className="flex items-center gap-2 flex-wrap">
      <span className="mono text-xs flex-shrink-0" style={{ color: '#444' }}>ONLINE</span>

      {users.map((user, index) => {
        const isYou = user.userName === currentUser || (mySessionId && user.sessionId === mySessionId);
        const muted = isMutedFor(user.sessionId);

        return (
          <div
            key={user.sessionId || index}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: user.color || '#555' }} />
            <span className="text-xs font-medium" style={{ color: isYou ? '#fff' : '#aaa' }}>
              {user.userName}
            </span>
            {isYou && <span className="mono text-xs" style={{ color: '#444' }}>you</span>}
            {voiceEnabled && muted !== undefined && <MicIndicator muted={muted} />}
          </div>
        );
      })}

      <span className="ml-auto mono text-xs flex-shrink-0" style={{ color: '#444' }}>{users.length}/6</span>
    </div>
  );
}

export default UserList;
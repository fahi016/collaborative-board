// src/components/ChatMessage.jsx
import { useMemo } from 'react';

function ChatMessage({ message, isOwnMessage }) {
  const formattedTime = useMemo(() => {
    if (!message.createdAt) return '';
    const date = new Date(message.createdAt);
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, [message.createdAt]);

  const senderColor = useMemo(() => {
    if (isOwnMessage) return '#ffffff';
    let hash = 0;
    for (let i = 0; i < message.senderName.length; i++)
      hash = message.senderName.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 65%)`;
  }, [message.senderName, isOwnMessage]);

  return (
    <div className={`flex flex-col gap-1 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
        <span className="text-xs font-semibold" style={{ color: senderColor }}>
          {isOwnMessage ? 'You' : message.senderName}
        </span>
        <span className="mono text-xs" style={{ color: '#444' }}>{formattedTime}</span>
      </div>
      <div
        className="max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed"
        style={
          isOwnMessage
            ? { background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f0', borderBottomRightRadius: '4px' }
            : { background: '#141414', border: '1px solid rgba(255,255,255,0.06)', color: '#ccc', borderBottomLeftRadius: '4px' }
        }
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
}

export default ChatMessage;
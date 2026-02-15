// src/components/ChatMessage.jsx
import { useMemo } from 'react';

function ChatMessage({ message, isOwnMessage }) {
  const formattedTime = useMemo(() => {
    if (!message.createdAt) return '';

    const date = new Date(message.createdAt);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // Show date for older messages
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
    });
  }, [message.createdAt]);

  // Generate a consistent color based on sender name (for non-own messages)
  const senderColor = useMemo(() => {
    if (isOwnMessage) return '#3B82F6'; // Blue for own messages

    // Generate a color from the sender name
    let hash = 0;
    for (let i = 0; i < message.senderName.length; i++) {
      hash = message.senderName.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = hash % 360;
    return `hsl(${hue}, 60%, 50%)`;
  }, [message.senderName, isOwnMessage]);

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
        {/* Sender name and time */}
        <div className={`flex items-center space-x-2 mb-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
          {!isOwnMessage && (
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: senderColor }}
            />
          )}
          <span
            className="text-xs font-medium"
            style={{ color: isOwnMessage ? '#3B82F6' : senderColor }}
          >
            {isOwnMessage ? 'You' : message.senderName}
          </span>
          <span className="text-xs text-gray-400">
            {formattedTime}
          </span>
        </div>

        {/* Message bubble */}
        <div
          className={`px-3 py-2 rounded-lg ${
            isOwnMessage
              ? 'bg-blue-600 text-white rounded-br-none'
              : 'bg-gray-100 text-gray-800 rounded-bl-none'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;
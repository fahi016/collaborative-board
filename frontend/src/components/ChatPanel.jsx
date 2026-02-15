// src/components/ChatPanel.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import ChatMessage from './ChatMessage';

function ChatPanel({ roomId, currentUser, isOpen, onClose, messages, onSendMessage }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const { showToast } = useToast();

  const MAX_LENGTH = 2000;

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load chat history when panel opens
  useEffect(() => {
    if (isOpen && messages.length === 0 && !loadingHistory) {
      loadChatHistory();
    }
  }, [isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const loadChatHistory = async () => {
    if (loadingHistory || !hasMore) return;

    setLoadingHistory(true);
    try {
      const response = await api.getChatHistory(roomId, page, 50);

      if (response.content && response.content.length > 0) {
        // Messages come in DESC order (newest first), reverse them
        const reversedMessages = [...response.content].reverse();

        // Since we're displaying in chronological order,
        // append old messages at the beginning
        // But for first load, just set them
        if (page === 0) {
          // First load - these are the most recent messages
          // They'll be added to state in parent component
        }

        setHasMore(!response.last);
        setPage(prev => prev + 1);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      showToast('Failed to load chat history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;

    if (content.length > MAX_LENGTH) {
      showToast(`Message too long (max ${MAX_LENGTH} characters)`, 'error');
      return;
    }

    setLoading(true);
    try {
      await onSendMessage(content);
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
      showToast(error.message || 'Failed to send message', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const remainingChars = MAX_LENGTH - input.length;
  const isNearLimit = remainingChars < 200;

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200 flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
          <h3 className="font-semibold text-gray-800">Chat</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 transition"
          title="Close chat"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {loadingHistory && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="flex items-center space-x-2 text-gray-500">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Loading messages...</span>
            </div>
          </div>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1">Be the first to say something!</p>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            isOwnMessage={message.senderName === currentUser}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 bg-gray-50">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              disabled={loading}
              maxLength={MAX_LENGTH}
            />
            {isNearLimit && (
              <p className={`text-xs mt-1 ${remainingChars < 50 ? 'text-red-500' : 'text-orange-500'}`}>
                {remainingChars} characters remaining
              </p>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={`px-4 py-2 rounded-lg font-medium transition flex items-center space-x-1 ${
              loading || !input.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            title="Send message (Enter)"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}

export default ChatPanel;
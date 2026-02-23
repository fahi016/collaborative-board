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
    <div className="fixed top-0 right-0 h-full w-96 bg-slate-800 shadow-elevation-4 border-l border-slate-700 flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-bold text-white">Chat</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white hover:bg-slate-700 transition-smooth p-2 rounded-lg"
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
        className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-slate-900/50"
      >
        {loadingHistory && messages.length === 0 && (
          <div className="flex justify-center py-12">
            <div className="flex items-center space-x-2 text-slate-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-medium">Loading messages...</span>
            </div>
          </div>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-400">No messages yet</p>
            <p className="text-xs mt-1 text-slate-500">Be the first to say something!</p>
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
      <div className="border-t border-slate-700 p-4 bg-slate-800">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-500 transition-smooth"
              rows={2}
              disabled={loading}
              maxLength={MAX_LENGTH}
            />
            {isNearLimit && (
              <p className={`text-xs mt-1.5 px-1 ${remainingChars < 50 ? 'text-red-400 font-semibold' : 'text-orange-400'}`}>
                {remainingChars} characters remaining
              </p>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={`px-4 py-3 rounded-xl font-semibold transition-smooth flex items-center justify-center shadow-elevation-1 hover:shadow-elevation-2 ${
              loading || !input.trim()
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
            }`}
            title="Send message (Enter)"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 flex items-center space-x-2">
          <span>Press</span>
          <kbd className="px-2 py-0.5 bg-slate-700 border border-slate-600 rounded text-xs font-medium">Enter</kbd>
          <span>to send,</span>
          <kbd className="px-2 py-0.5 bg-slate-700 border border-slate-600 rounded text-xs font-medium">Shift+Enter</kbd>
          <span>for new line</span>
        </p>
      </div>
    </div>
  );
}

export default ChatPanel;
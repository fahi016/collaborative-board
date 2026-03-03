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
  const { showToast } = useToast();
  const MAX_LENGTH = 2000;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0 && !loadingHistory) loadChatHistory();
  }, [isOpen]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const loadChatHistory = async () => {
    if (loadingHistory || !hasMore) return;
    setLoadingHistory(true);
    try {
      const response = await api.getChatHistory(roomId, page, 50);
      if (response.content && response.content.length > 0) {
        setHasMore(!response.last);
        setPage(prev => prev + 1);
      } else { setHasMore(false); }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      showToast('Failed to load history', 'error');
    } finally { setLoadingHistory(false); }
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;
    if (content.length > MAX_LENGTH) { showToast(`Max ${MAX_LENGTH} characters`, 'error'); return; }
    setLoading(true);
    try { await onSendMessage(content); setInput(''); }
    catch (error) { showToast(error.message || 'Failed to send', 'error'); }
    finally { setLoading(false); }
  };

  const handleKeyDown = (e) => {
    // Prevent canvas/global shortcuts from hijacking keyboard while typing chat.
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const remainingChars = MAX_LENGTH - input.length;

  if (!isOpen) return null;

  return (
    <aside
      className="fixed right-0 top-0 z-40 h-full flex flex-col"
      style={{ width: '340px', background: '#0a0a0a', borderLeft: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#555' }}>
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd"/>
          </svg>
          <span className="text-xs font-semibold text-white">Chat</span>
        </div>
        <button onClick={onClose} className="btn-ghost rounded-lg w-7 h-7 flex items-center justify-center t">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-3" style={{ background: '#0a0a0a' }}>
        {loadingHistory && messages.length === 0 && (
          <div className="flex items-center justify-center py-12 gap-2" style={{ color: '#444' }}>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span className="text-xs">Loading…</span>
          </div>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: '#444' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
            </div>
            <p className="text-xs" style={{ color: '#444' }}>No messages yet. Say hi!</p>
          </div>
        )}

        {messages.map(message => (
          <ChatMessage key={message.id} message={message} isOwnMessage={message.senderName === currentUser} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-end gap-2">
          <textarea
            data-chat-input="true"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={2}
            disabled={loading}
            maxLength={MAX_LENGTH}
            className="input-base flex-1 rounded-lg px-3 py-2 text-sm resize-none scrollbar-thin"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg t disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: input.trim() ? '#ffffff' : '#1e1e1e', color: input.trim() ? '#0a0a0a' : '#444', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {loading ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            )}
          </button>
        </div>
        {remainingChars < 200 && (
          <p className="mono text-xs mt-1.5" style={{ color: remainingChars < 50 ? '#ef4444' : '#666' }}>
            {remainingChars} left
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: '#333' }}>Enter to send · Shift+Enter for newline</p>
      </div>
    </aside>
  );
}

export default ChatPanel;

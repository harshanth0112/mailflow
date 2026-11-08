import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  X,
  Send,
  Minimize2,
  Maximize2,
  Copy,
  Check,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createChatConversation,
  getChatConversations,
  sendChatMessage,
} from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const AiChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && !conversationId) {
      initConversation();
    }
  }, [isOpen, conversationId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const initConversation = async () => {
    try {
      const res = await createChatConversation({ title: 'Quick Assistant Session' });
      setConversationId(res.data._id);
    } catch (err) {
      console.error('Failed to init widget conversation', err);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading || !conversationId) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [
      ...prev,
      { _id: 'tmp-' + Date.now(), role: 'user', content: userText },
    ]);
    setLoading(true);

    try {
      const res = await sendChatMessage(conversationId, { prompt: userText });
      if (res.data?.assistantMessage) {
        setMessages((prev) => [...prev, res.data.assistantMessage]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          _id: 'err-' + Date.now(),
          role: 'assistant',
          content: 'Unable to reach MailFlow AI right now. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyText = (txt, idx) => {
    navigator.clipboard.writeText(txt);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-medium text-xs shadow-lg hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5"
          title="Open MailFlow AI Assistant"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>MailFlow AI</span>
        </button>
      ) : (
        <div
          className={`rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isMinimized
              ? 'w-72 h-14'
              : 'w-96 sm:w-[420px] h-[520px]'
          }`}
        >
          {/* Header */}
          <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide">MailFlow AI</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
                {messages.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <Sparkles className="w-8 h-8 text-pink-400 mx-auto" />
                    <p className="font-semibold text-white">Hi, I'm MailFlow AI!</p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Ask me to draft email copy, write subject lines, or help you with your campaigns.
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div
                      key={m._id || idx}
                      className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`p-3 rounded-2xl max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                          m.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none'
                        }`}
                      >
                        {m.content}

                        {m.role !== 'user' && (
                          <div className="mt-2 pt-1 border-t border-slate-700/60 flex justify-end">
                            <button
                              onClick={() => copyText(m.content, idx)}
                              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                            >
                              {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {loading && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
                    <LoadingSpinner size="sm" />
                    <span>Writing response...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Form */}
              <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a question or request a draft..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};


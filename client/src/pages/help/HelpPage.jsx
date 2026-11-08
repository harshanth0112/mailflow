import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  Send,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  MessageSquare,
  HelpCircle,
  Lightbulb,
  FileText,
  Mail,
  Shield,
  Trash2,
  Plus,
} from 'lucide-react';
import {
  getChatConversations,
  createChatConversation,
  getChatMessages,
  sendChatMessage,
  deleteChatConversation,
  runAiQuickAction,
} from '../../services/api';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const SUGGESTED_PROMPTS = [
  {
    icon: Mail,
    label: 'Draft Re-engagement Email',
    prompt: 'Write a warm, engaging re-engagement email for inactive subscribers offering an exclusive benefit.',
    type: 'draft_email',
  },
  {
    icon: Lightbulb,
    label: 'Generate Subject Lines',
    prompt: 'Generate 5 high-converting subject lines for a product launch announcement with personalization tags.',
    type: 'subject_lines',
  },
  {
    icon: Sparkles,
    label: 'Improve Email Tone',
    prompt: 'Please polish this email to sound professional yet friendly: "Hey, check our new features now."',
    type: 'improve_tone',
  },
  {
    icon: BookOpen,
    label: 'How Auto-Reply Works',
    prompt: 'Explain how MailFlow prevents email reply loops and how cooldown settings work.',
    type: 'general',
  },
];

export const HelpPage = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const res = await getChatConversations();
      const list = res.data || [];
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        selectConversation(list[0]._id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  const selectConversation = async (convId) => {
    setActiveConversationId(convId);
    setLoading(true);
    try {
      const res = await getChatMessages(convId);
      setMessages(res.data?.messages || []);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const startNewConversation = async () => {
    try {
      const res = await createChatConversation({ title: 'New Conversation' });
      const newConv = res.data;
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv._id);
      setMessages([]);
    } catch (err) {
      console.error('Failed to start conversation', err);
    }
  };

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    try {
      await deleteChatConversation(convId);
      setConversations((prev) => prev.filter((c) => c._id !== convId));
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const handleSend = async (overridePrompt = null, actionType = 'general') => {
    const textToSend = overridePrompt || inputPrompt;
    if (!textToSend.trim() || sending) return;

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      try {
        const newConv = await createChatConversation({ title: textToSend.slice(0, 30) });
        targetConvId = newConv.data._id;
        setConversations((prev) => [newConv.data, ...prev]);
        setActiveConversationId(targetConvId);
      } catch (err) {
        return;
      }
    }

    // Optimistically append user message
    const tempUserMsg = {
      _id: 'temp-' + Date.now(),
      role: 'user',
      content: textToSend.trim(),
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInputPrompt('');
    setSending(true);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await sendChatMessage(targetConvId, {
        prompt: textToSend.trim(),
        actionType,
      });

      if (res.data?.assistantMessage) {
        setMessages((prev) => [...prev, res.data.assistantMessage]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          _id: 'err-' + Date.now(),
          role: 'assistant',
          content: 'Sorry, I encountered an issue processing your request. Please try again.',
          createdAt: new Date(),
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
              <Bot className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">MailFlow AI Assistant & Help Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              AI Powered
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Get context-aware campaign help, draft personalized marketing copy, and generate high-converting subject lines.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={startNewConversation} className="text-xs self-start">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Chat
        </Button>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[620px]">
        {/* Sidebar: Conversation History & Quick Prompts */}
        <div className="lg:col-span-1 space-y-5">
          {/* Quick Action Buttons */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
              Quick Generators
            </span>
            <div className="space-y-1.5">
              {SUGGESTED_PROMPTS.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSend(p.prompt, p.type)}
                    disabled={sending}
                    className="w-full text-left p-2 rounded-lg bg-slate-950/60 hover:bg-indigo-600/20 border border-slate-800/80 hover:border-indigo-500/40 transition-colors flex items-center gap-2 text-xs text-slate-300 group"
                  >
                    <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 shrink-0" />
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversations History List */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Chat History
              </span>
              <span className="text-[10px] text-slate-500 font-mono">({conversations.length})</span>
            </div>

            {conversations.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">No previous conversations.</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {conversations.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => selectConversation(c._id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      activeConversationId === c._id
                        ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate flex-1 pr-2">{c.title || 'Untitled Chat'}</span>
                    <button
                      onClick={(e) => handleDeleteConversation(e, c._id)}
                      className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/50 flex flex-col h-[650px] overflow-hidden">
          {/* Chat Messages Body */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-base font-bold text-white">How can MailFlow AI help you today?</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Ask me to write an email campaign draft, brainstorm subject lines, or explain how to configure
                    workspace safeguards and auto-replies.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div
                  key={m._id || idx}
                  className={`flex gap-3.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role !== 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed relative group ${
                      m.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-800/90 border border-slate-700/80 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                    {m.role !== 'user' && (
                      <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-end">
                        <button
                          onClick={() => copyToClipboard(m.content, idx)}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy response</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {m.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/30 border border-indigo-500/40 flex items-center justify-center text-indigo-200 shrink-0 mt-0.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))
            )}

            {sending && (
              <div className="flex gap-3.5 items-center">
                <div className="w-7 h-7 rounded-lg bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs text-slate-400 flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  <span>MailFlow AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Input Box */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask MailFlow AI to write an email, brainstorm subjects, or explain features..."
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                disabled={sending}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <Button type="submit" size="sm" disabled={sending || !inputPrompt.trim()} className="text-xs px-4">
                <Send className="w-3.5 h-3.5 mr-1" />
                Send
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

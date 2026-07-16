import { useState, useRef, useEffect, FormEvent, useCallback } from 'react';
import { PaperAirplaneIcon, XMarkIcon, MinusIcon, ExclamationTriangleIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { useChat } from '../hooks/useChat';
import { useAuthStore } from '../stores/auth.store';
import { useFeatureFlagsStore } from '../stores/featureFlags.store';

const SUGGESTED = [
  'Show all pending tasks',
  'Upcoming appointments',
  'How many activities total?',
  'Overdue follow-ups',
  'Show me all deals',
  'List all accounts',
];

/* ── Inline bold renderer ─────────────────────────────── */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/* ── Markdown renderer for AI messages ───────────────── */
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<div key={i} className="h-1" />);
    } else if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\.\s/)![1];
      const content = trimmed.replace(/^\d+\.\s/, '');
      elements.push(
        <div key={i} className="flex gap-1.5 items-start">
          <span className="text-gray-400 font-mono text-xs mt-0.5 shrink-0 w-3.5">{num}.</span>
          <span className="flex-1 text-xs leading-relaxed">{renderInline(content)}</span>
        </div>
      );
    } else if (/^[-•*]\s/.test(trimmed)) {
      const content = trimmed.replace(/^[-•*]\s/, '');
      elements.push(
        <div key={i} className="flex gap-1.5 items-start">
          <span className="text-gray-400 shrink-0 mt-0.5 text-xs">•</span>
          <span className="flex-1 text-xs leading-relaxed">{renderInline(content)}</span>
        </div>
      );
    } else if (trimmed.startsWith('===') && trimmed.endsWith('===')) {
      // skip raw data-block headers
    } else {
      elements.push(
        <p key={i} className="text-xs leading-relaxed">{renderInline(line)}</p>
      );
    }
  });

  return <div className="space-y-0.5">{elements}</div>;
}

/* ── Typing indicator ─────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex items-end gap-2 px-4 py-2">
      <BotAvatar size="sm" />
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce"
              style={{ animationDelay: `${i * 0.18}s`, animationDuration: '0.8s' }}
            />
          ))}
          <span className="text-xs text-gray-400 ml-1.5">Searching CRM…</span>
        </div>
      </div>
    </div>
  );
}

/* ── Bot avatar ───────────────────────────────────────── */
function BotAvatar({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'h-9 w-9' : 'h-6 w-6';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0 shadow-sm`}>
      <svg viewBox="0 0 24 24" fill="none" className={size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'} stroke="white" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    </div>
  );
}

/* ── Main widget ─────────────────────────────────────── */
export default function ChatWidget() {
  const user  = useAuthStore((s) => s.user);
  const { flags } = useFeatureFlagsStore();
  const { messages, isLoading, sendMessage, clearChat } = useChat();

  const [open, setOpen]         = useState(false);
  const [minimised, setMin]     = useState(false);
  const [input, setInput]       = useState('');
  const [pulse, setPulse]       = useState(true);
  const [isListening, setIsListening] = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const hasSpeechAPI = typeof window !== 'undefined' && !!(w.SpeechRecognition || w.webkitSpeechRecognition);

  const startVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setIsListening(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      setInput(e.results[0][0].transcript);
      setIsListening(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend   = () => setIsListening(false);
    rec.start();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (open && !minimised) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, minimised]);

  const submit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  }, [input, isLoading, sendMessage]);

  const onSuggest = (q: string) => {
    if (isLoading) return;
    sendMessage(q);
  };

  if (!user || user.role === 'SUPER_ADMIN' || flags.bot_enabled === false) return null;

  return (
    <>
      {/* ── Open panel ── */}
      {open && (
        <div
          className={`fixed bottom-24 right-6 z-50 flex flex-col transition-all duration-300 print:hidden ${
            minimised ? 'h-14' : 'h-[580px]'
          }`}
          style={{ width: 420 }}
        >
          <div className="flex flex-col h-full rounded-2xl overflow-hidden shadow-2xl border border-white/20"
            style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)' }}>

            {/* Header */}
            <div className="relative flex items-center gap-3 px-4 py-3.5 shrink-0"
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #9333ea 100%)' }}>
              <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -bottom-4 -left-4 h-14 w-14 rounded-full bg-white/10 pointer-events-none" />

              <BotAvatar size="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">AI Assistant</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-white/70">Online · Replies instantly</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setMin((v) => !v)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                  title={minimised ? 'Expand' : 'Minimise'}
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { setOpen(false); setMin(false); }}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                  title="Close"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            {!minimised && (
              <>
                <div className="flex-1 overflow-y-auto py-3 space-y-1"
                  style={{ background: 'linear-gradient(180deg, #f8f7ff 0%, #ffffff 100%)' }}>

                  {/* Empty state */}
                  {messages.length === 0 && (
                    <div className="px-4 pt-4 pb-2 space-y-4">
                      {/* Welcome bubble */}
                      <div className="flex items-start gap-2.5">
                        <BotAvatar size="sm" />
                        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[300px]">
                          <p className="text-sm text-gray-800 leading-relaxed">
                            Hi! I'm your CRM assistant. I can search tasks, follow-ups, appointments, and your Zoho, HubSpot, Salesforce data instantly.
                          </p>
                        </div>
                      </div>

                      {/* Suggested questions */}
                      <div className="pl-8">
                        <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wider">Try asking</p>
                        <div className="flex flex-wrap gap-2">
                          {SUGGESTED.map((q) => (
                            <button
                              key={q}
                              onClick={() => onSuggest(q)}
                              className="text-xs px-3 py-1.5 rounded-full border border-brand-200 text-brand-600 bg-brand-50
                                         hover:bg-brand-100 hover:border-brand-300 transition-colors shadow-sm"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  {messages.map((msg) => (
                    <div key={msg.id}
                      className={`flex items-end gap-2 px-4 py-0.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                      {msg.role === 'assistant' && <BotAvatar size="sm" />}

                      <div className={`max-w-[300px] rounded-2xl px-4 py-3 shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-br-sm'
                          : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
                      }`}>
                        {msg.role === 'assistant'
                          ? renderMarkdown(msg.content)
                          : <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        }

                        {msg.escalated && (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-yellow-200">
                            <ExclamationTriangleIcon className="h-3 w-3 text-yellow-500 shrink-0" />
                            <span className="text-xs text-yellow-600 font-medium">Connecting to a human agent…</span>
                          </div>
                        )}

                        {msg.capturedData && Object.keys(msg.capturedData).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-emerald-100 space-y-0.5">
                            {Object.entries(msg.capturedData).map(([k, v]) => (
                              <p key={k} className="text-xs text-emerald-700">
                                <span className="font-medium capitalize">{k}:</span> {v}
                              </p>
                            ))}
                          </div>
                        )}

                        <p className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {isLoading && <TypingDots />}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="px-3 py-3 bg-white border-t border-gray-100 shrink-0">
                  <form onSubmit={submit} className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={isListening ? 'Listening…' : 'Ask about tasks, contacts, follow-ups…'}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent disabled:opacity-50 transition-all bg-gray-50 focus:bg-white"
                    />
                    {hasSpeechAPI && (
                      <button
                        type="button"
                        onClick={startVoice}
                        disabled={isLoading || isListening}
                        title={isListening ? 'Listening…' : 'Speak a command'}
                        className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                          isListening
                            ? 'bg-red-500 text-white animate-pulse shadow-md'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                        } disabled:opacity-40`}
                      >
                        <MicrophoneIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-md disabled:opacity-40 hover:shadow-lg transition-all active:scale-95"
                    >
                      <PaperAirplaneIcon className="h-4 w-4" />
                    </button>
                  </form>
                  <div className="flex items-center justify-between mt-2 px-1">
                    <p className="text-xs text-gray-300">Powered by LeadRyze AI</p>
                    {messages.length > 0 && (
                      <button onClick={clearChat} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
                        Clear chat
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Launcher button ── */}
      <button
        onClick={() => { setOpen((v) => !v); setMin(false); setPulse(false); }}
        aria-label="Open AI assistant"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-90 hover:scale-105 print:hidden"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)' }}
      >
        {pulse && !open && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #9333ea)' }} />
        )}

        {open ? (
          <XMarkIcon className="h-6 w-6 text-white" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="white" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        )}

        {!open && messages.filter((m) => m.role === 'assistant').length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
            <span className="text-white text-xs font-bold leading-none">
              {messages.filter((m) => m.role === 'assistant').length}
            </span>
          </span>
        )}
      </button>
    </>
  );
}

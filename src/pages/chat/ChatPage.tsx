import { useState, useRef, useEffect, FormEvent } from 'react';
import { PaperAirplaneIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useChat } from '../../hooks/useChat';
import { format } from 'date-fns';

const SUGGESTED_QUESTIONS = [
  'Show me all deals',
  'How many contacts do we have?',
  'List all accounts',
  'Show recent tasks',
  'What products do we have?',
  'Find contact by phone number',
  'Show all invoices',
  'List open cases',
];

/* ── Simple markdown renderer — handles bold, bullets, numbered lists ── */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold text-gray-900">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={i} className="h-1" />);
    } else if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\.\s/)![1];
      const content = trimmed.replace(/^\d+\.\s/, '');
      elements.push(
        <div key={i} className="flex gap-2 items-start">
          <span className="text-gray-400 font-mono text-xs mt-0.5 shrink-0 w-4">{num}.</span>
          <span className="flex-1">{renderInline(content)}</span>
        </div>
      );
    } else if (/^[-•*]\s/.test(trimmed)) {
      const content = trimmed.replace(/^[-•*]\s/, '');
      elements.push(
        <div key={i} className="flex gap-2 items-start">
          <span className="text-gray-400 shrink-0 mt-0.5">•</span>
          <span className="flex-1">{renderInline(content)}</span>
        </div>
      );
    } else if (trimmed.startsWith('===') && trimmed.endsWith('===')) {
      // Skip raw section headers from the data block — already rendered by Claude
    } else {
      elements.push(
        <p key={i} className="leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }

  return <div className="space-y-1 text-sm">{elements}</div>;
}

export default function ChatPage() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const onSuggest = (q: string) => {
    if (isLoading) return;
    sendMessage(q);
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Chat</h1>
          <p className="text-sm text-gray-500">Ask anything about your CRM data</p>
        </div>
        <button onClick={clearChat} className="btn-secondary gap-2">
          <TrashIcon className="h-4 w-4" /> Clear
        </button>
      </div>

      <div className="card flex-1 flex flex-col overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Empty state with suggested questions */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <ChatBubbleEmptyIcon />
              <p className="mt-3 text-sm font-semibold text-gray-600">
                Ask me about your CRM data
              </p>
              <p className="text-xs text-gray-400 mt-1 mb-5">
                I can search across Zoho, HubSpot, and Salesforce
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => onSuggest(q)}
                    className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full
                               hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700
                               transition-colors text-gray-600 shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-1">
                  AI
                </div>
              )}
              <div
                className={`max-w-xs sm:max-w-md lg:max-w-2xl rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white rounded-tr-sm'
                    : 'bg-gray-50 border border-gray-100 text-gray-900 rounded-tl-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  renderMarkdown(msg.content)
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}

                {msg.escalated && (
                  <div className="flex items-center gap-1 mt-2 text-yellow-600 text-xs">
                    <ExclamationTriangleIcon className="h-3 w-3" />
                    Escalated to human
                  </div>
                )}
                {msg.capturedData && Object.keys(msg.capturedData).length > 0 && (
                  <div className="mt-2 border-t border-gray-200 pt-2">
                    {Object.entries(msg.capturedData).map(([k, v]) => (
                      <p key={k} className="text-xs text-gray-500">
                        <span className="font-medium capitalize">{k}:</span> {v}
                      </p>
                    ))}
                  </div>
                )}
                <p
                  className={`text-xs mt-1.5 ${
                    msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                  }`}
                >
                  {format(msg.timestamp, 'HH:mm')}
                </p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                AI
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full bg-brand-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                  <span className="text-xs text-gray-400 ml-2">Searching CRM data…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-gray-100 p-4">
          <form onSubmit={onSubmit} className="flex gap-3">
            <input
              type="text"
              className="input flex-1"
              placeholder="Ask about deals, contacts, products, invoices…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="btn-primary px-4"
              disabled={isLoading || !input.trim()}
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ChatBubbleEmptyIcon() {
  return (
    <svg
      className="mx-auto h-12 w-12 text-gray-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

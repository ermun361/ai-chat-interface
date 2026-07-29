'use client';

import { useChat } from '@ai-sdk/react';
import { useRef, useEffect, useState } from 'react';
import { Send, StopCircle, User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function Chat() {
  // 1. Local state for the text box (v5 no longer manages input state for you).
  const [myMessage, setMyMessage] = useState('');

  // 2. v5 API: no more `append` or `isLoading`.
  //    Use `sendMessage` and `status` instead.
  const { messages, sendMessage, status, stop } = useChat();

  const isLoading = status === 'submitted' || status === 'streaming';

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 3. This function runs when you click the Send button
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!myMessage.trim() || isLoading) return;

    try {
      // v5: sendMessage takes a `text` field instead of `content`
      await sendMessage({ text: myMessage });

      // Clear the box after it sends
      setMyMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Something went wrong. Check your API key!');
    }
  };

  // Helper: v5 messages store text inside a `parts` array, not `.content`
  const getMessageText = (m: (typeof messages)[number]) =>
    m.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => ('text' in p ? p.text : ''))
      .join('') ?? '';

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 bg-white text-black font-sans border-x">
      {/* Header */}
      <header className="py-4 border-b flex justify-between items-center bg-white px-2">
        <h1 className="text-xl font-bold flex items-center gap-2 text-blue-600">
          <Bot size={24} /> AI Assistant
        </h1>
        {isLoading && (
          <span className="text-xs text-blue-500 animate-pulse font-bold uppercase">
            Streaming...
          </span>
        )}
      </header>

      {/* Chat History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center py-20 text-slate-400 italic text-sm">
            <Bot size={40} className="mx-auto mb-2 opacity-20" />
            <p>I&apos;m ready. Type something to start!</p>
          </div>
        )}

        {messages.map((m, index) => (
          <div key={m.id ?? index} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-slate-800 border'
              }`}
            >
              <div className="text-sm leading-relaxed prose prose-slate">
                <ReactMarkdown>{getMessageText(m)}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}

        {/* Thinking Indicator */}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-white border p-4 rounded-2xl text-slate-400 text-sm animate-pulse">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-4 border-t flex gap-2 bg-white">
        <input
          className="flex-1 p-3 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
          value={myMessage}
          placeholder="Type your message..."
          onChange={(e) => setMyMessage(e.target.value)}
          disabled={isLoading}
          autoFocus
        />

        {isLoading ? (
          <button
            type="button"
            onClick={() => stop()}
            className="p-3 bg-red-500 text-white rounded-xl shadow-md"
          >
            <StopCircle size={24} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!myMessage || myMessage.trim().length === 0}
            className={`p-3 rounded-xl transition-all shadow-md ${
              myMessage.trim().length > 0
                ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send size={24} />
          </button>
        )}
      </form>
    </div>
  );
}
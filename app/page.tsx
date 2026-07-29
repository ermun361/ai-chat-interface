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
  const { messages, sendMessage, status, stop, setMessages } = useChat();

  const isLoading = status === 'submitted' || status === 'streaming';

  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Scroll-pinning state ---
  // `isPinned` tracks whether the user is currently at (or near) the bottom.
  // We only auto-scroll on new content when they're pinned — the instant
  // they scroll up, we stop yanking their view back down.
  const [isPinned, setIsPinned] = useState(true);

  // How close to the bottom (in px) still counts as "at the bottom".
  // A small tolerance avoids fighting sub-pixel scroll rounding.
  const BOTTOM_THRESHOLD = 80;

  const checkIfAtBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= BOTTOM_THRESHOLD;
  };

  // Fires on every scroll (including scroll events caused by streaming
  // content pushing the container taller). Whatever the cause, if the user
  // ends up away from the bottom, unpin.
  const handleScroll = () => {
    setIsPinned(checkIfAtBottom());
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setIsPinned(true);
  };

  // Auto-scroll logic: only follow new content while pinned to the bottom.
  // This effect re-runs on every token during streaming (messages is a new
  // array reference each chunk), so it keeps following live output — but
  // only for users who haven't scrolled away.
  useEffect(() => {
    if (isPinned) {
      // 'auto' (instant) during streaming avoids a laggy smooth-scroll
      // fighting with rapidly arriving tokens.
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' });
    }
  }, [messages, isPinned]);

  // --- Persistence (localStorage) ---
  // Client-only, per-browser storage — a refresh mid-conversation isn't a
  // data-loss event, but this doesn't sync across devices/browsers (that
  // would need a real backend + some notion of a user/session).
  const CHAT_STORAGE_KEY = 'ai-chat-messages';

  // Guards against a race: on mount, the "load" effect below calls
  // setMessages(...) to hydrate from storage, but that state update
  // doesn't apply synchronously. If the "save" effect (which runs on every
  // `messages` change) fired on its very first pass, it would see the
  // original empty `messages` array and immediately overwrite the saved
  // chat with `[]` — before the load's update ever lands. Skipping exactly
  // the first save avoids this without depending on effect timing.
  const isFirstSaveRef = useRef(true);

  // Load once, on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to load saved chat:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on every change to messages (new turns, streamed updates, etc.)
  useEffect(() => {
    if (isFirstSaveRef.current) {
      isFirstSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (err) {
      console.error('Failed to save chat:', err);
    }
  }, [messages]);

  const handleClearChat = () => {
    setMessages([]);
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear saved chat:', err);
    }
  };

  // This function runs when you click the Send button
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!myMessage.trim() || isLoading) return;

    try {
      // v5: sendMessage takes a `text` field instead of `content`
      await sendMessage({ text: myMessage });

      // Sending your own message should always bring you back to the
      // bottom, even if you'd scrolled up to re-read earlier context.
      scrollToBottom('smooth');

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

  // --- Streaming-safe Markdown ---
  // While a response is mid-stream, the text is *incomplete Markdown* by
  // definition — a code fence or inline-code backtick may have opened but
  // not yet closed. Feeding that straight to ReactMarkdown causes visible
  // flicker/breakage for the one render before the closing token arrives
  // (backticks show as literal text, or everything after gets swallowed
  // into a phantom code block).
  //
  // Fix: patch the string so it's always syntactically *balanced* before
  // rendering. If a construct is still open, temporarily close it. The
  // very next chunk replaces this patched string anyway, so nothing is
  // lost — we're just never handing the parser invalid Markdown.
  const sanitizeStreamingMarkdown = (md: string): string => {
    let result = md;

    // 1. Balance triple-backtick code fences (```). An odd count means
    //    the last fence is still open — close it so the block renders
    //    as a code block instead of leaking into whatever comes after.
    const fenceCount = (result.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) {
      result += '\n```';
    }

    // 2. Balance single backticks for inline code (`like this`), but only
    //    count backticks *outside* fenced code blocks (those are already
    //    balanced by step 1, and backticks inside them aren't inline-code
    //    delimiters).
    const withoutFences = result.replace(/```[\s\S]*?```/g, '');
    const singleBacktickCount = (withoutFences.match(/`/g) || []).length;
    if (singleBacktickCount % 2 !== 0) {
      result += '`';
    }

    return result;
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 bg-white text-black font-sans border-x">
      {/* Header */}
      <header className="py-4 border-b flex justify-between items-center bg-white px-2">
        <h1 className="text-xl font-bold flex items-center gap-2 text-blue-600">
          <Bot size={24} /> AI Assistant
        </h1>
        <div className="flex items-center gap-3">
          {isLoading && (
            <span className="text-xs text-blue-500 animate-pulse font-bold uppercase">
              Streaming...
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
            >
              Clear chat
            </button>
          )}
        </div>
      </header>

      {/* Chat History (wrapped so the jump-to-latest button can float above it,
          fixed to the viewport, instead of scrolling away with the content) */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto p-4 space-y-6 bg-slate-50"
        >
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
                  <ReactMarkdown>{sanitizeStreamingMarkdown(getMessageText(m))}</ReactMarkdown>
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

        {/* Jump-to-latest: only shown once the user has scrolled away from
            the bottom. Clicking it snaps back and re-pins auto-scroll. */}
        {!isPinned && messages.length > 0 && (
          <button
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-slate-800 text-white text-xs font-medium shadow-lg hover:bg-slate-900 transition-colors"
          >
            ↓ Jump to latest
          </button>
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
'use client';

/**
 * AI copilot — lives as the "Chat AI" tab in the RightSidebar (same tab bar as
 * Design/Settings/Interactions). Drives /ycode/api/ai/chat, which reuses the
 * project's own MCP editing tools, so the assistant has full control of the page
 * (text, images, sizes, layout, colors). Styled with the editor's tokens only —
 * no separators, no branding, no filler.
 */
import { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';

type Msg = { role: 'user' | 'assistant'; content: string; edited?: boolean };

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ExpandIcon({ className, expanded }: { className?: string; expanded?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      {expanded ? (
        <path d="M9 9l-5-5M4 9V4h5M15 15l5 5M20 15v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M4 14v5h5M9 4H4v5M20 10V5h-5M15 20h5v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export default function AiChat({ expanded, onToggleExpand }: { expanded?: boolean; onToggleExpand?: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentPageId = useEditorStore((s) => s.currentPageId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading || !currentPageId) return;
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/ycode/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          page_id: currentPageId,
          selected_layer_id: selectedLayerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: 'assistant', content: data.error || 'Something went wrong.' }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: data.message || 'Done.', edited: data.edited }]);
        if (data.edited) await usePagesStore.getState().loadDraft(currentPageId);
      }
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Network error — please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 flex flex-col gap-4">
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="self-end max-w-[85%] rounded-lg bg-secondary text-foreground text-[13px] px-3 py-2 whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <div key={i} className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap flex flex-col gap-2">
              <div>{m.content}</div>
              {m.edited && (
                <span className="inline-flex items-center gap-1.5 self-start rounded-md px-2 py-0.5 text-[11px] text-muted-foreground bg-secondary">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Changes applied
                </span>
              )}
            </div>
          ),
        )}
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
            <Spinner /> Working…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-3">
        <div className="rounded-lg bg-secondary focus-within:ring-1 focus-within:ring-ring transition-shadow">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask AI to change anything…"
            rows={expanded ? 3 : 2}
            className="min-h-0 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 text-[13px] px-3 py-2.5"
          />
          <div className="flex items-center gap-1 px-2 pb-2">
            {onToggleExpand && (
              <button
                type="button"
                onClick={onToggleExpand}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
                aria-label={expanded ? 'Collapse' : 'Expand'}
                title={expanded ? 'Collapse' : 'Expand'}
              >
                <ExpandIcon className="size-4" expanded={expanded} />
              </button>
            )}
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim() || !currentPageId}
              className="ml-auto flex size-7 items-center justify-center rounded-md bg-blue-500 text-white hover:bg-blue-500/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              <SendIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

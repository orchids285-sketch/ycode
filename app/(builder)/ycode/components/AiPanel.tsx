'use client';

/**
 * AI copilot panel for the editor. Chat surface that drives /ycode/api/ai/chat,
 * which reuses the project's own MCP editing tools — so the assistant has full
 * control of the page (text, images, sizes, layout, colors). Styled with the
 * editor's own shadcn primitives + tokens (bg-background / border-l / muted).
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';

type Msg = { role: 'user' | 'assistant'; content: string; edited?: boolean };

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" fill="currentColor" />
    </svg>
  );
}
function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AiPanel() {
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
        // Reload the page draft so the canvas reflects the AI's edits.
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
    <div className="w-80 shrink-0 bg-background border-l flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-11 border-b shrink-0">
        <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-500 text-white">
          <SparkIcon className="size-3.5" />
        </span>
        <span className="text-sm font-semibold">Creatives AI</span>
        <span className="ml-auto text-[11px] text-muted-foreground">Full control</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-[13px] text-muted-foreground leading-relaxed">
            Ask me to change anything on this page — text, images, sizes, colors, layout.
            <br />
            <span className="text-muted-foreground/70">e.g. “make the heading bigger and blue”, “convert all temperatures to Celsius”, “add a hero image”.</span>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="self-end max-w-[85%] rounded-lg bg-secondary text-foreground text-[13px] px-3 py-2 whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <div key={i} className="flex gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-500 text-white">
                <SparkIcon className="size-3.5" />
              </span>
              <div className="min-w-0 flex flex-col gap-2">
                <div className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">{m.content}</div>
                {m.edited && (
                  <span className="inline-flex items-center gap-1.5 self-start rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-emerald-500" /> Changes applied
                  </span>
                )}
              </div>
            </div>
          ),
        )}
        {loading && (
          <div className="flex items-center gap-2.5 text-muted-foreground text-[13px]">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-500 text-white">
              <SparkIcon className="size-3.5" />
            </span>
            <Spinner /> Working on it…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-3 border-t shrink-0">
        <div className="rounded-lg border bg-background focus-within:border-ring transition-colors">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Creatives AI…"
            rows={2}
            className="min-h-0 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 text-[13px] px-3 py-2.5"
          />
          <div className="flex items-center gap-1.5 px-2 pb-2">
            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">
              <SparkIcon className="size-3" /> Build
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">Fast</span>
            <Button
              type="button"
              size="icon"
              onClick={() => void send()}
              disabled={loading || !input.trim() || !currentPageId}
              className={cn('ml-auto size-7 rounded-md')}
              aria-label="Send"
            >
              <SendIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

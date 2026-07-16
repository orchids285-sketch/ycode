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

// --- Offline command layer -------------------------------------------------
// So the assistant DOES something even without a configured LLM key: recognise
// the common ad moves and drive the exact same store actions the toolbar menus
// use (templates / formats / backgrounds). Anything not matched falls through
// to the real (generative) LLM route.
const TEMPLATE_KEYWORDS: [RegExp, string, string][] = [
  [/promo|sale|discount|deal|%\s?off|percent off/, 'ad-promo', 'Promo / Sale'],
  [/product|spotlight|feature/, 'ad-product', 'Product spotlight'],
  [/testimonial|review|quote|rating|stars?/, 'ad-testimonial', 'Testimonial'],
  [/launch|announce|announcement|coming soon|waitlist/, 'ad-launch', 'Launch / Announcement'],
  [/coupon|code|voucher/, 'ad-discount', 'Discount code'],
  [/webinar|event|register|seminar|workshop/, 'ad-event', 'Webinar / Event'],
];
const FORMAT_KEYWORDS: [RegExp, number, number, string][] = [
  [/square|1:1|feed post/, 1080, 1080, 'Square'],
  [/story|reel|9:16/, 1080, 1920, 'Story / Reel'],
  [/portrait|4:5/, 1080, 1350, 'Portrait'],
  [/landscape|16:9|wide/, 1200, 675, 'Landscape'],
  [/facebook feed|fb feed|1\.91/, 1200, 628, 'Feed'],
  [/pinterest|2:3/, 1000, 1500, 'Pinterest'],
  [/youtube|thumbnail/, 1280, 720, 'YouTube thumbnail'],
];
const BG_KEYWORDS: [RegExp, string[], string][] = [
  [/gradient/, ['bg-gradient-to-br', 'from-[#4f46e5]', 'to-[#9333ea]'], 'gradient'],
  [/dark|black/, ['bg-[#111111]'], 'dark'],
  [/white/, ['bg-[#ffffff]'], 'white'],
  [/navy|slate|dark blue/, ['bg-[#0f172a]'], 'navy'],
  [/indigo|purple|violet/, ['bg-[#4f46e5]'], 'indigo'],
  [/red|crimson/, ['bg-[#dc2626]'], 'red'],
  [/green|emerald/, ['bg-[#059669]'], 'green'],
  [/amber|yellow|gold/, ['bg-[#f5c542]'], 'amber'],
  [/pink|magenta/, ['bg-[#ec4899]'], 'pink'],
];

const SIZE_RE = /^(w-\[|h-\[|max-w-|min-w-|min-h-|max-h-)/;
const BG_RE = /^(bg-|from-|to-|via-)/;
function toStr(c: string | string[] | undefined): string {
  return Array.isArray(c) ? c.join(' ') : c || '';
}
function mergeSize(existing: string | string[] | undefined, size: string): string {
  const kept = toStr(existing).split(/\s+/).filter(Boolean).filter((c) => !SIZE_RE.test(c) && c !== 'mx-auto' && c !== 'overflow-hidden');
  return [...kept, ...size.split(' ').filter(Boolean)].join(' ').trim();
}
function mergeBg(existing: string | string[] | undefined, bg: string[]): string {
  const kept = toStr(existing).split(/\s+/).filter(Boolean).filter((c) => !BG_RE.test(c));
  return [...kept, ...bg].join(' ').trim();
}

function runLocalCommand(text: string, pageId: string): string | null {
  const t = ' ' + text.toLowerCase() + ' ';
  const store = usePagesStore.getState();
  const applied: string[] = [];

  for (const [re, id, label] of TEMPLATE_KEYWORDS) {
    if (re.test(t)) { store.addLayerFromTemplate(pageId, 'body', id); applied.push(`added a “${label}” layout`); break; }
  }
  let body = store.draftsByPageId[pageId]?.layers?.[0];
  for (const [re, w, h, label] of FORMAT_KEYWORDS) {
    if (re.test(t) && body) {
      store.updateLayerClasses(pageId, body.id, mergeSize(body.classes, `w-[${w}px] h-[${h}px] mx-auto overflow-hidden`));
      applied.push(`set the format to ${label} (${w}×${h})`);
      break;
    }
  }
  body = store.draftsByPageId[pageId]?.layers?.[0];
  for (const [re, classes, label] of BG_KEYWORDS) {
    if (re.test(t) && body) {
      store.updateLayerClasses(pageId, body.id, mergeBg(body.classes, classes));
      applied.push(`set a ${label} background`);
      break;
    }
  }

  if (!applied.length) return null;
  void store.saveDraft(pageId);
  const cap = applied.map((s, i) => (i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s));
  return cap.join(', ') + '.';
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AiChat() {
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

    // Try the offline command layer first — instant, no LLM key needed.
    const local = runLocalCommand(text, currentPageId);
    if (local) {
      setMessages((m) => [...m, { role: 'assistant', content: local, edited: true }]);
      return;
    }

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
            placeholder=""
            rows={2}
            className="min-h-0 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 text-[13px] px-3 py-2.5"
          />
          <div className="flex items-center gap-1 px-2 pb-2">
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

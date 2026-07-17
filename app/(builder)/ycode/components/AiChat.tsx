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
import { getLayerFromTemplate } from '@/lib/templates/blocks';
import { getTiptapTextContent } from '@/lib/text-format-utils';
import { useSlidesStore } from '@/stores/useSlidesStore';
import { enableDeck } from '@/lib/slides';
import type { Layer } from '@/types';

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
  const applied: string[] = [];
  // Read state FRESH each step: every store.set() replaces draftsByPageId with a
  // new object, so a captured snapshot goes stale (a bg edit would clobber the
  // format edit). getState() re-reads the latest classes each time.
  const bodyLayer = () => usePagesStore.getState().draftsByPageId[pageId]?.layers?.[0];

  for (const [re, id, label] of TEMPLATE_KEYWORDS) {
    if (re.test(t)) { usePagesStore.getState().addLayerFromTemplate(pageId, 'body', id); applied.push(`added a “${label}” layout`); break; }
  }
  for (const [re, w, h, label] of FORMAT_KEYWORDS) {
    const body = bodyLayer();
    if (re.test(t) && body) {
      usePagesStore.getState().updateLayerClasses(pageId, body.id, mergeSize(body.classes, `w-[${w}px] h-[${h}px] mx-auto overflow-hidden`));
      applied.push(`set the format to ${label} (${w}×${h})`);
      break;
    }
  }
  for (const [re, classes, label] of BG_KEYWORDS) {
    const body = bodyLayer();
    if (re.test(t) && body) {
      usePagesStore.getState().updateLayerClasses(pageId, body.id, mergeBg(body.classes, classes));
      applied.push(`set a ${label} background`);
      break;
    }
  }

  if (!applied.length) return null;
  void usePagesStore.getState().saveDraft(pageId);
  const cap = applied.map((s, i) => (i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s));
  return cap.join(', ') + '.';
}

// --- Prompt → ad generator (fuel-free) -------------------------------------
// Builds a CUSTOM ad from a free-text brief: extracts the offer/subject and a
// call-to-action, picks a base template, rewrites its text with the user's own
// words, then inserts it (reusing getLayerFromTemplate + addLayerWithId) and
// applies any requested format/background. Not an LLM, but it genuinely
// generates a tailored ad from a sentence.
const CTA_PHRASES = [
  'shop now', 'buy now', 'order now', 'get started', 'sign up', 'sign-up', 'register now', 'register',
  'join the waitlist', 'join now', 'join', 'learn more', 'download now', 'download', 'subscribe',
  'book now', 'book a demo', 'try for free', 'try free', 'start free', 'get yours', 'claim offer',
  'claim your discount', 'see more', 'discover more', 'get the deal', 'save my seat', 'reserve your spot',
];
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const sentenceCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function extractCTA(t: string): string | null {
  for (const p of CTA_PHRASES) { if (t.includes(p)) return titleCase(p); }
  return null;
}

function extractContent(raw: string): { headline: string; eyebrow: string; subline: string } | null {
  const t = raw.toLowerCase();
  let headline: string | null = null;

  const offer = raw.match(/(\d{1,3})\s?%\s?off/i);
  const price = raw.match(/(?:^|\s)(\$\s?\d+(?:\.\d{1,2})?)/);
  const quote = raw.match(/["“”']([^"“”']{3,70})["“”']/);
  const subjectM =
    raw.match(/\b(?:ad|advert(?:isement)?|creative|banner|campaign|poster|flyer)\s+(?:for|about|promoting)\s+(.+?)(?:[.,;]| with | in | using | that | featuring |$)/i) ||
    raw.match(/\b(?:promote|advertise|market|sell)\s+(.+?)(?:[.,;]| with | in | to |$)/i);

  if (offer) headline = `${offer[1]}% OFF`;
  else if (price) headline = titleCase(price[1].replace(/\s/g, ''));
  else if (quote) headline = quote[1].trim();
  else if (subjectM && subjectM[1]) {
    const subj = subjectM[1].trim().split(/\s+/).slice(0, 6).join(' ');
    if (subj.length >= 2) headline = titleCase(subj);
  }
  if (!headline) return null; // not enough content — let the command layer handle it

  // eyebrow from a recognizable occasion / tag
  const occ = t.match(/black friday|cyber monday|flash sale|new arrival|limited time|clearance|grand opening|early access|now open|free webinar/);
  const eyebrow = occ ? occ[0].toUpperCase() : (offer ? 'LIMITED TIME OFFER' : 'NEW');

  // subline: prefer the subject if the headline was an offer/quote; else a leftover phrase
  let subline = '';
  if ((offer || price || quote) && subjectM && subjectM[1]) {
    subline = sentenceCase(subjectM[1].trim().split(/\s+/).slice(0, 10).join(' '));
  }
  if (!subline) {
    const leftover = raw
      .replace(/\b(make|create|generate|design|build|do|please|a|an|the|ad|advert(?:isement)?|creative|banner|for|about)\b/gi, ' ')
      .replace(/\s+/g, ' ').trim();
    if (leftover.split(' ').length >= 3) subline = sentenceCase(leftover.split(/\s+/).slice(0, 12).join(' '));
  }
  if (!subline) subline = offer ? 'For a limited time only.' : 'Find out more today.';

  return { headline, eyebrow, subline };
}

function pickTemplate(t: string): string {
  if (/webinar|event|register|seminar|workshop|conference/.test(t)) return 'ad-event';
  if (/testimonial|review|["“”']/.test(t)) return 'ad-testimonial';
  if (/launch|announce|coming soon|waitlist|pre-?order/.test(t)) return 'ad-launch';
  if (/coupon|code|voucher/.test(t)) return 'ad-discount';
  return 'ad-promo';
}

function setLayerText(node: Layer, text: string) {
  node.variables = {
    ...(node.variables || {}),
    text: { type: 'dynamic_rich_text', data: { content: getTiptapTextContent(text) } },
  } as Layer['variables'];
}

// Fill the template tree with the extracted copy (headline / eyebrow / subline / cta).
function rewriteAdTree(root: Layer, copy: { headline: string; eyebrow: string; subline: string; cta: string | null }) {
  const headings: Layer[] = [];
  const paras: Layer[] = [];
  const btnTexts: Layer[] = [];
  const walk = (node: Layer, parent: Layer | null) => {
    if (node.name === 'heading') headings.push(node);
    else if (node.name === 'text') (parent && parent.name === 'button' ? btnTexts : paras).push(node);
    (node.children || []).forEach((c) => walk(c, node));
  };
  walk(root, null);
  if (headings[0]) setLayerText(headings[0], copy.headline);
  if (btnTexts[0] && copy.cta) setLayerText(btnTexts[0], copy.cta);
  if (paras.length >= 2) {
    setLayerText(paras[0], copy.eyebrow);
    setLayerText(paras[paras.length - 1], copy.subline);
  } else if (paras.length === 1) {
    setLayerText(paras[0], copy.subline);
  }
}

function generateAdFromPrompt(text: string, pageId: string): string | null {
  const t = ' ' + text.toLowerCase() + ' ';
  const content = extractContent(text);
  if (!content) return null; // no real ad content → fall back to command layer

  const templateId = pickTemplate(t);
  const tree = getLayerFromTemplate(templateId);
  if (!tree) return null;
  const cta = extractCTA(t);
  rewriteAdTree(tree, { ...content, cta });

  const store = usePagesStore.getState();
  store.addLayerWithId(pageId, 'body', tree);

  const applied: string[] = [`generated a custom ad — “${content.headline}”`];
  const bodyLayer = () => usePagesStore.getState().draftsByPageId[pageId]?.layers?.[0];
  for (const [re, w, h, label] of FORMAT_KEYWORDS) {
    const body = bodyLayer();
    if (re.test(t) && body) { usePagesStore.getState().updateLayerClasses(pageId, body.id, mergeSize(body.classes, `w-[${w}px] h-[${h}px] mx-auto overflow-hidden`)); applied.push(`format ${label} (${w}×${h})`); break; }
  }
  for (const [re, classes, label] of BG_KEYWORDS) {
    const body = bodyLayer();
    if (re.test(t) && body) { usePagesStore.getState().updateLayerClasses(pageId, body.id, mergeBg(body.classes, classes)); applied.push(`${label} background`); break; }
  }
  void usePagesStore.getState().saveDraft(pageId);
  return sentenceCase(applied.join(', ')) + '. Edit any text right on the canvas.';
}

// --- Prompt → slide DECK generator (presentation mode, fuel-free) -----------
function collectByRole(root: Layer): { headings: Layer[]; paras: Layer[] } {
  const headings: Layer[] = [];
  const paras: Layer[] = [];
  const walk = (n: Layer, p: Layer | null) => {
    if (n.name === 'heading') headings.push(n);
    else if (n.name === 'text' && !(p && p.name === 'button')) paras.push(n);
    (n.children || []).forEach((c) => walk(c, n));
  };
  walk(root, null);
  return { headings, paras };
}

function extractTopic(raw: string): string {
  const m = raw.match(/(?:deck|presentation|slides?|pitch|slideshow|slide deck)\s+(?:about|on|for|regarding|:)?\s*(.+)/i);
  let topic = m && m[1] ? m[1] : raw;
  topic = topic.replace(/\b(?:with|in|of)\s+\d+\s+slides?\b.*/i, '').trim();
  topic = topic.split(/\s*(?:,|;| covering | including | that | featuring )\s*/i)[0].replace(/[.,;:]+$/, '').trim();
  const words = topic.split(/\s+/).filter(Boolean).slice(0, 9);
  return words.length ? titleCase(words.join(' ')) : 'Untitled deck';
}

const DEFAULT_AGENDA = ['Overview', 'Why it matters', 'How it works', 'Key benefits', 'Roadmap', 'Case study', 'Pricing', 'Next steps'];

function extractSlideHeadings(raw: string): string[] {
  // "covering / including / sections / agenda / :" introduce the slide list.
  // NOT "about" — that introduces the topic (handled by extractTopic).
  const listM = raw.match(/(?:covering|including|with sections?|sections?|agenda|:)\s+(.+)$/i);
  if (listM) {
    const parts = listM[1]
      .split(/\s*,\s*|\s+and\s+|\s*\/\s*|\s*;\s*/i)
      .map((s) => s.replace(/[.,;]+$/, '').trim())
      .filter((s) => s.length >= 2);
    if (parts.length >= 2) return parts.slice(0, 8).map(sentenceCase);
  }
  const cnt = raw.match(/(\d+)\s+slides?/i);
  const total = cnt ? Math.min(10, Math.max(2, parseInt(cnt[1], 10))) : 5;
  return DEFAULT_AGENDA.slice(0, total - 1);
}

function generateDeckFromPrompt(text: string, pageId: string): string | null {
  const topic = extractTopic(text);
  const headings = extractSlideHeadings(text);
  const store = usePagesStore.getState();

  enableDeck(pageId); // make sure the body is a deck stage

  // Title slide
  const title = getLayerFromTemplate('slide-title');
  if (title) {
    const { headings: h, paras: p } = collectByRole(title);
    if (h[0]) setLayerText(h[0], topic);
    if (p.length >= 2) setLayerText(p[p.length - 1], `An overview of ${topic.toLowerCase()}`);
    store.addLayerWithId(pageId, 'body', title);
  }
  // Content slides
  for (const head of headings) {
    const slide = getLayerFromTemplate('slide-content');
    if (!slide) continue;
    const { headings: h } = collectByRole(slide);
    if (h[0]) setLayerText(h[0], head);
    store.addLayerWithId(pageId, 'body', slide);
  }
  void store.saveDraft(pageId);
  const n = headings.length + 1;
  return `Built a ${n}-slide deck on “${topic}”. Each slide is fully editable on the canvas — click any text to rewrite it.`;
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

    // Presentation mode: the prompt builds a slide DECK instead of an ad.
    if (useSlidesStore.getState().enabled) {
      const deck = generateDeckFromPrompt(text, currentPageId);
      if (deck) {
        setMessages((m) => [...m, { role: 'assistant', content: deck, edited: true }]);
        return;
      }
    }

    // Offline, no LLM key needed: first try to GENERATE a custom ad from the
    // brief; if it isn't a content brief, fall back to the simple command layer
    // (templates / formats / backgrounds). Anything else goes to the LLM route.
    const generated = generateAdFromPrompt(text, currentPageId);
    if (generated) {
      setMessages((m) => [...m, { role: 'assistant', content: generated, edited: true }]);
      return;
    }
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

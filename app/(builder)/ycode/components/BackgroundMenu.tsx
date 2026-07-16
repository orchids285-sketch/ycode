'use client';

/**
 * Background quick-styler for the Creatives editor. Sets the creative frame's
 * background (solid or gradient) in one click — the fastest, most common ad
 * design move. Reuses the layer system (updateLayerClasses on the body layer),
 * exactly like the ad-format menu, and the editor's own Button + DropdownMenu +
 * Icon primitives. No new rendering, no new design.
 */
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';

// Solid swatches (hex) and gradient presets (Tailwind arbitrary stops).
const SOLIDS = ['#ffffff', '#111111', '#0f172a', '#4f46e5', '#dc2626', '#059669', '#f5c542', '#ec4899'];
const GRADIENTS: { css: string; classes: string[] }[] = [
  { css: 'linear-gradient(135deg,#4f46e5,#9333ea)', classes: ['bg-gradient-to-br', 'from-[#4f46e5]', 'to-[#9333ea]'] },
  { css: 'linear-gradient(135deg,#f97316,#ec4899)', classes: ['bg-gradient-to-br', 'from-[#f97316]', 'to-[#ec4899]'] },
  { css: 'linear-gradient(135deg,#0ea5e9,#14b8a6)', classes: ['bg-gradient-to-br', 'from-[#0ea5e9]', 'to-[#14b8a6]'] },
  { css: 'linear-gradient(135deg,#111827,#374151)', classes: ['bg-gradient-to-br', 'from-[#111827]', 'to-[#374151]'] },
  { css: 'linear-gradient(135deg,#fb7185,#fbbf24)', classes: ['bg-gradient-to-br', 'from-[#fb7185]', 'to-[#fbbf24]'] },
  { css: 'linear-gradient(135deg,#6366f1,#22d3ee)', classes: ['bg-gradient-to-br', 'from-[#6366f1]', 'to-[#22d3ee]'] },
];

const BG_RE = /^(bg-|from-|to-|via-)/;

function mergeBg(existing: string | string[] | undefined, bgClasses: string[]): string {
  const base = Array.isArray(existing) ? existing.join(' ') : existing || '';
  const kept = base.split(/\s+/).filter(Boolean).filter((c) => !BG_RE.test(c));
  return [...kept, ...bgClasses].join(' ').trim();
}

export default function BackgroundMenu() {
  const currentPageId = useEditorStore((s) => s.currentPageId);

  const apply = (bgClasses: string[]) => {
    if (!currentPageId) return;
    const draft = usePagesStore.getState().draftsByPageId[currentPageId];
    const body = draft?.layers?.[0];
    if (!body) return;
    const next = mergeBg(body.classes as string | string[] | undefined, bgClasses);
    usePagesStore.getState().updateLayerClasses(currentPageId, body.id, next);
    void usePagesStore.getState().saveDraft(currentPageId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="input" size="sm" className="gap-1.5" title="Background">
          <Icon name="droplet" className="size-3.5! opacity-70" />
          <span>Background</span>
          <Icon name="chevronDown" className="size-2.5! opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="bottom" sideOffset={4} className="w-56 p-2">
        <DropdownMenuLabel className="px-1">Solid</DropdownMenuLabel>
        <div className="grid grid-cols-8 gap-1 px-1 pb-2">
          {SOLIDS.map((hex) => (
            <button
              key={hex}
              type="button"
              title={hex}
              onClick={() => apply([`bg-[${hex}]`])}
              className="h-5 w-5 rounded-sm border border-border cursor-pointer transition-transform hover:scale-110"
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
        <DropdownMenuLabel className="px-1">Gradient</DropdownMenuLabel>
        <div className="grid grid-cols-6 gap-1 px-1">
          {GRADIENTS.map((g) => (
            <button
              key={g.css}
              type="button"
              onClick={() => apply(g.classes)}
              className="h-6 w-full rounded-sm border border-border cursor-pointer transition-transform hover:scale-105"
              style={{ background: g.css }}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

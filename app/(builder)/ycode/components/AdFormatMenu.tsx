'use client';

/**
 * Ad-format presets for the Creatives editor. Sizes the current page's root
 * (body) to a standard ad canvas (square, story, feed, …) so the design reads
 * as a fixed ad creative — the thing Ycode-as-a-website-builder lacked. Reuses
 * the existing layer system (updateLayerClasses) — no new rendering. Styled with
 * the editor's own Button + DropdownMenu + Icon primitives.
 */
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';

type Format = { label: string; ratio: string; w: number; h: number };

const FORMATS: Format[] = [
  { label: 'Square post', ratio: '1:1', w: 1080, h: 1080 },
  { label: 'Portrait post', ratio: '4:5', w: 1080, h: 1350 },
  { label: 'Story / Reel', ratio: '9:16', w: 1080, h: 1920 },
  { label: 'Landscape', ratio: '16:9', w: 1200, h: 675 },
  { label: 'Feed (Facebook)', ratio: '1.91:1', w: 1200, h: 628 },
  { label: 'Pinterest', ratio: '2:3', w: 1000, h: 1500 },
  { label: 'YouTube thumbnail', ratio: '16:9', w: 1280, h: 720 },
];

const SIZE_RE = /^(w-\[|h-\[|max-w-|min-w-|min-h-|max-h-)/;

function mergeSize(existing: string | string[] | undefined, sizeClasses: string): string {
  const base = Array.isArray(existing) ? existing.join(' ') : existing || '';
  const kept = base
    .split(/\s+/)
    .filter(Boolean)
    .filter((c) => !SIZE_RE.test(c) && c !== 'mx-auto' && c !== 'overflow-hidden');
  return [...kept, ...sizeClasses.split(' ').filter(Boolean)].join(' ').trim();
}

export default function AdFormatMenu() {
  const currentPageId = useEditorStore((s) => s.currentPageId);

  const apply = (fmt: Format | null) => {
    if (!currentPageId) return;
    const draft = usePagesStore.getState().draftsByPageId[currentPageId];
    const body = draft?.layers?.[0];
    if (!body) return;
    const size = fmt
      ? `w-[${fmt.w}px] h-[${fmt.h}px] mx-auto overflow-hidden`
      : '';
    const next = mergeSize(body.classes as string | string[] | undefined, size);
    usePagesStore.getState().updateLayerClasses(currentPageId, body.id, next);
    void usePagesStore.getState().saveDraft(currentPageId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="input" size="sm" className="gap-1.5" title="Ad format">
          <Icon name="image" className="size-3.5! opacity-70" />
          <span className="text-center">Format</span>
          <Icon name="chevronDown" className="size-2.5! opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="bottom" sideOffset={4} className="w-52">
        <DropdownMenuLabel>Ad format</DropdownMenuLabel>
        {FORMATS.map((f) => (
          <DropdownMenuItem key={f.label} onClick={() => apply(f)}>
            <span className="flex-1">{f.label}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{f.w}×{f.h}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => apply(null)}>
          <span className="flex-1">Free size</span>
          <span className="text-muted-foreground text-xs">reset</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

'use client';

/**
 * Export the current creative as an image — the "produce the ad file" step.
 * Captures the sized creative frame (the iframe's <body>, which carries the
 * chosen ad-format size classes) from the same-origin design iframe using
 * html-to-image (already a dependency). Styled with the editor's own
 * Button + DropdownMenu + Icon primitives.
 */
import { useState } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

function getCreativeElement(): HTMLElement | null {
  const iframe = document.querySelector('iframe[title="Canvas Editor"]') as HTMLIFrameElement | null;
  const doc = iframe?.contentDocument;
  if (!doc) return null;
  // The ad-format size classes (w-[1080px] h-[1080px] …) live on the iframe's
  // real <body> element (Canvas.tsx moves them off #canvas-body, which is
  // display:contents). So <body> IS the sized creative frame we export.
  return doc.body;
}

export default function ExportCreativeButton() {
  const [busy, setBusy] = useState(false);

  const exportAs = async (format: 'png' | 'jpeg', scale: number) => {
    const el = getCreativeElement();
    if (!el) return;
    setBusy(true);
    try {
      const opts = {
        pixelRatio: scale,
        cacheBust: true,
        backgroundColor: '#ffffff',
        width: el.offsetWidth || undefined,
        height: el.offsetHeight || undefined,
      };
      const dataUrl =
        format === 'png' ? await toPng(el, opts) : await toJpeg(el, { ...opts, quality: 0.95 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `creative-${el.offsetWidth}x${el.offsetHeight}.${format === 'jpeg' ? 'jpg' : 'png'}`;
      a.click();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[export] failed:', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="input" size="sm" className="gap-1.5" title="Export creative" disabled={busy}>
          {busy ? <Spinner className="size-3.5!" /> : <Icon name="arrow-down" className="size-3.5! opacity-70" />}
          <span>Export</span>
          <Icon name="chevronDown" className="size-2.5! opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="bottom" sideOffset={4} className="w-52">
        <DropdownMenuLabel>Export creative</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => exportAs('png', 2)}>
          <span className="flex-1">PNG</span>
          <span className="text-muted-foreground text-xs">2×</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAs('jpeg', 2)}>
          <span className="flex-1">JPG</span>
          <span className="text-muted-foreground text-xs">2×</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportAs('png', 1)}>
          <span className="flex-1">PNG</span>
          <span className="text-muted-foreground text-xs">1×</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

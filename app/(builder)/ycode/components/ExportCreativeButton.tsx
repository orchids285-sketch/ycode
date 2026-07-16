'use client';

/**
 * Export the current creative — as a still image (PNG/JPG) or as an animated
 * VIDEO ad (WebM). Both capture the sized creative frame (the iframe's <body>,
 * which carries the ad-format size classes) via html-to-image (already a
 * dependency). The video path turns that still into motion (zoom / pan / fade)
 * on a canvas and records it with the browser-native MediaRecorder — no new
 * library. Styled with the editor's own Button + DropdownMenu + Icon primitives.
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

function download(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

type Motion = 'zoom' | 'pan' | 'fade';

// Paint one frame of the moving creative onto the canvas at progress p (0..1).
function drawFrame(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, p: number, motion: Motion) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const e = easeInOut(p);
  if (motion === 'zoom') {
    const s = 1 + 0.09 * e;
    ctx.translate(w / 2, h / 2); ctx.scale(s, s); ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(img, 0, 0, w, h);
  } else if (motion === 'pan') {
    const s = 1.1;
    const maxShift = w * (s - 1);
    ctx.translate(-maxShift * e, 0);
    ctx.translate(w / 2, h / 2); ctx.scale(s, s); ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    // fade + gentle settle
    ctx.globalAlpha = Math.min(1, p / 0.35);
    const s = 1.06 - 0.06 * easeInOut(Math.min(1, p / 0.7));
    ctx.translate(w / 2, h / 2); ctx.scale(s, s); ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(img, 0, 0, w, h);
  }
  ctx.restore();
}

export default function ExportCreativeButton() {
  const [busy, setBusy] = useState(false);

  const exportImage = async (format: 'png' | 'jpeg', scale: number) => {
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
      const dataUrl = format === 'png' ? await toPng(el, opts) : await toJpeg(el, { ...opts, quality: 0.95 });
      download(dataUrl, `creative-${el.offsetWidth}x${el.offsetHeight}.${format === 'jpeg' ? 'jpg' : 'png'}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[export] image failed:', e);
    } finally {
      setBusy(false);
    }
  };

  const exportVideo = async (motion: Motion) => {
    const el = getCreativeElement();
    if (!el) return;
    if (typeof MediaRecorder === 'undefined') {
      // eslint-disable-next-line no-console
      console.error('[export] MediaRecorder not supported in this browser.');
      return;
    }
    setBusy(true);
    try {
      const w = el.offsetWidth || 1080;
      const h = el.offsetHeight || 1080;
      // Snapshot the creative once, then animate that still on a canvas.
      const dataUrl = await toPng(el, { pixelRatio: 1, cacheBust: true, backgroundColor: '#ffffff', width: w, height: h });
      const img = await loadImage(dataUrl);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      drawFrame(ctx, img, w, h, 0, motion); // prime first frame

      const fps = 30;
      const durationMs = 4000;
      // captureStream isn't in every TS DOM lib version — cast to keep the build green.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = (canvas as any).captureStream(fps) as MediaStream;
      // Prefer MP4/H.264 (what ad platforms want) when the browser can record it
      // (Chrome 130+); otherwise fall back to WebM. No transcoding library needed.
      const mime =
        [
          'video/mp4;codecs=avc1.640028',
          'video/mp4;codecs=h264',
          'video/mp4',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
        ].find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
      const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });

      rec.start();
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          const p = Math.min(1, (now - start) / durationMs);
          drawFrame(ctx, img, w, h, p, motion);
          if (p < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      // hold the last frame briefly so the ending reads cleanly
      await new Promise((r) => setTimeout(r, 250));
      rec.stop();
      await stopped;

      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      download(url, `creative-${w}x${h}-${motion}.${ext}`);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[export] video failed:', e);
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
      <DropdownMenuContent align="center" side="bottom" sideOffset={4} className="w-56">
        <DropdownMenuLabel>Image</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => exportImage('png', 2)}>
          <span className="flex-1">PNG</span>
          <span className="text-muted-foreground text-xs">2×</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportImage('jpeg', 2)}>
          <span className="flex-1">JPG</span>
          <span className="text-muted-foreground text-xs">2×</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportImage('png', 1)}>
          <span className="flex-1">PNG</span>
          <span className="text-muted-foreground text-xs">1×</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Video (MP4 · 4s)</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => exportVideo('zoom')}>
          <span className="flex-1">Zoom in</span>
          <span className="text-muted-foreground text-xs">motion</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportVideo('pan')}>
          <span className="flex-1">Pan</span>
          <span className="text-muted-foreground text-xs">motion</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportVideo('fade')}>
          <span className="flex-1">Fade in</span>
          <span className="text-muted-foreground text-xs">motion</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

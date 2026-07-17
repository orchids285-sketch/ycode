'use client';

/**
 * Presentation mode = the real Presenton (open-source AI presentation
 * generator) running inside the editor. When Slides mode is on we cover the
 * canvas with a full-bleed Presenton iframe — nothing is re-created here, the
 * actual Presenton app does the deck building. Self-hosted on Railway; it sends
 * no X-Frame-Options / CSP frame-ancestors, so it embeds directly.
 */
import { useSlidesStore } from '@/stores/useSlidesStore';

const PRESENTON_URL =
  process.env.NEXT_PUBLIC_PRESENTON_URL || 'https://presenton-production.up.railway.app';

export default function PresentonEmbed() {
  const enabled = useSlidesStore((s) => s.enabled);
  if (!enabled) return null;
  return (
    <div className="absolute inset-0 z-20 bg-background">
      <iframe
        src={PRESENTON_URL}
        title="Presenton"
        className="w-full h-full border-0"
        allow="clipboard-write; clipboard-read; fullscreen"
      />
    </div>
  );
}

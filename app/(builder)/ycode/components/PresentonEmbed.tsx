'use client';

/**
 * Presentation mode = the real Presenton (open-source AI presentation
 * generator) running inside the editor. When Slides mode is on we cover the
 * canvas with a full-bleed iframe — nothing is re-created here, the actual
 * Presenton app builds the decks. We point at the white-label GATEWAY, not
 * Presenton directly: the gateway strips auth (no login/create-admin gate),
 * removes Presenton branding, and strips CSP/X-Frame-Options so it embeds.
 */
import { useSlidesStore } from '@/stores/useSlidesStore';

// Land straight on the tool (/upload), skipping Presenton's Home/onboarding.
const PRESENTON_URL =
  process.env.NEXT_PUBLIC_PRESENTON_URL || 'https://presenton-gateway-production.up.railway.app/upload';

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

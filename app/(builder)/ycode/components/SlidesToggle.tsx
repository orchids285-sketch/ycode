'use client';

/**
 * The mini toggle that flips the editor between the ad creator and presentation
 * mode. Presentation mode swaps the canvas for the embedded Presenton app
 * (see PresentonEmbed) — this button only flips the shared mode flag; it does
 * NOT build slides itself. Ycode's own Button + Icon; active = filled variant.
 */
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useSlidesStore } from '@/stores/useSlidesStore';

export default function SlidesToggle() {
  const enabled = useSlidesStore((s) => s.enabled);
  const toggle = useSlidesStore((s) => s.toggle);

  return (
    <Button
      variant={enabled ? 'default' : 'input'}
      size="sm"
      className="gap-1.5"
      title={enabled ? 'Exit presentation mode' : 'Slides — presentation mode'}
      onClick={toggle}
    >
      <Icon name="slides" className="size-3.5!" />
      <span>Slides</span>
    </Button>
  );
}

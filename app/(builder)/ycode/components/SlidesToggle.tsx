'use client';

/**
 * The mini toggle that flips the editor between the ad creator and the
 * presentation (slides) builder. On enable it turns the body into a deck stage
 * and seeds a title + content slide; on disable it restores the single creative.
 * Ycode's own Button + Icon; the active state uses the filled button variant.
 */
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useSlidesStore } from '@/stores/useSlidesStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { enableDeck, disableDeck, addSlide, slideCount } from '@/lib/slides';

export default function SlidesToggle() {
  const enabled = useSlidesStore((s) => s.enabled);
  const setEnabled = useSlidesStore((s) => s.setEnabled);
  const pageId = useEditorStore((s) => s.currentPageId);

  const onToggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (!pageId) return;
    if (next) {
      enableDeck(pageId);
      if (slideCount(pageId) === 0) {
        addSlide(pageId, 'slide-title');
        addSlide(pageId, 'slide-content');
      }
    } else {
      disableDeck(pageId);
    }
  };

  return (
    <Button
      variant={enabled ? 'default' : 'input'}
      size="sm"
      className="gap-1.5"
      title={enabled ? 'Exit slides mode' : 'Slides mode'}
      onClick={onToggle}
    >
      <Icon name="slides" className="size-3.5!" />
      <span>Slides</span>
    </Button>
  );
}

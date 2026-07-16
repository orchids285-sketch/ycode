'use client';

/**
 * Slide-mode toolbar controls (shown in place of the ad menus when Slides mode
 * is on): add a slide (title / content / section) and a live slide count.
 * Reuses lib/slides + Ycode's Button / DropdownMenu / Icon.
 */
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { addSlide } from '@/lib/slides';
import type { Layer } from '@/types';

const isSlide = (l: Layer) =>
  /w-\[1280px\]/.test(Array.isArray(l.classes) ? l.classes.join(' ') : l.classes || '');

export default function SlidesBar() {
  const pageId = useEditorStore((s) => s.currentPageId);
  const count = usePagesStore((s) => {
    const body = pageId ? s.draftsByPageId[pageId]?.layers?.[0] : undefined;
    return (body?.children || []).filter(isSlide).length;
  });

  const add = (id: 'slide-title' | 'slide-content' | 'slide-section') => {
    if (pageId) addSlide(pageId, id);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="input" size="sm" className="gap-1.5" title="Add slide">
            <Icon name="plus" className="size-3.5! opacity-70" />
            <span>Add slide</span>
            <Icon name="chevronDown" className="size-2.5! opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="bottom" sideOffset={4} className="w-48">
          <DropdownMenuLabel>Add slide</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => add('slide-title')}>Title slide</DropdownMenuItem>
          <DropdownMenuItem onClick={() => add('slide-content')}>Content slide</DropdownMenuItem>
          <DropdownMenuItem onClick={() => add('slide-section')}>Section slide</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-muted-foreground text-xs tabular-nums px-1 select-none">
        {count} slide{count === 1 ? '' : 's'}
      </span>
    </>
  );
}

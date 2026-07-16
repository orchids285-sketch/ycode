'use client';

/**
 * Ad-template picker for the Creatives editor. Inserts a ready-made ad
 * composition (promo, product, testimonial, launch) into the current creative
 * so you start from a designed ad, not a blank canvas. Reuses the existing
 * template pipeline (usePagesStore.addLayerFromTemplate) and the editor's own
 * Button + DropdownMenu + Icon primitives — no new rendering, no new design.
 */
import { Button } from '@/components/ui/button';
import { Icon, IconProps } from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';

const TEMPLATES: { id: string; label: string; icon: IconProps['name'] }[] = [
  { id: 'ad-promo', label: 'Promo / Sale', icon: 'zap' },
  { id: 'ad-product', label: 'Product spotlight', icon: 'image' },
  { id: 'ad-testimonial', label: 'Testimonial', icon: 'quote' },
  { id: 'ad-launch', label: 'Launch / Announcement', icon: 'zap' },
  { id: 'ad-discount', label: 'Discount code', icon: 'zap' },
  { id: 'ad-event', label: 'Webinar / Event', icon: 'calendar' },
];

export default function TemplatesMenu() {
  const currentPageId = useEditorStore((s) => s.currentPageId);

  const insert = (templateId: string) => {
    if (!currentPageId) return;
    // Insert as a child of the root creative (body). Reuses the standard
    // template pipeline (id assignment, ref resolution) unchanged.
    usePagesStore.getState().addLayerFromTemplate(currentPageId, 'body', templateId);
    void usePagesStore.getState().saveDraft(currentPageId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="input" size="sm" className="gap-1.5" title="Ad templates">
          <Icon name="layout" className="size-3.5! opacity-70" />
          <span>Templates</span>
          <Icon name="chevronDown" className="size-2.5! opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="bottom" sideOffset={4} className="w-56">
        <DropdownMenuLabel>Start from a template</DropdownMenuLabel>
        {TEMPLATES.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => insert(t.id)}>
            <Icon name={t.icon} className="size-3.5! opacity-70" />
            <span className="flex-1">{t.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

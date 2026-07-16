/**
 * Ad-creative Templates
 *
 * Ready-made ad compositions (promo, product, testimonial, launch) so the
 * Creatives editor starts from a designed ad instead of a blank canvas — the
 * "start from a template" flow a creatives tool needs. Each template is a
 * normal Layer tree that REUSES the existing content blocks (heading / text /
 * button) via getTemplateRef, so it flows through the same insertion + id
 * pipeline as every other block. Nothing new in the rendering path.
 */
import { BlockTemplate } from '@/types';
import { getTemplateRef } from '@/lib/templates/blocks';
import { getTiptapTextContent } from '@/lib/text-format-utils';

const richText = (text: string) => ({
  type: 'dynamic_rich_text' as const,
  data: { content: getTiptapTextContent(text) },
});

// Reuse the built-in blocks, overriding only text, classes and matching design.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function heading(text: string, classes: string[], typography: any, tag = 'h2') {
  return getTemplateRef('heading', {
    settings: { tag },
    classes,
    design: { typography: { isActive: true, ...typography } } as any,
    restrictions: { editText: true },
    variables: { text: richText(text) },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function paragraph(text: string, classes: string[], typography: any) {
  return getTemplateRef('text', {
    settings: { tag: 'p' },
    classes,
    design: { typography: { isActive: true, ...typography } } as any,
    restrictions: { editText: true },
    variables: { text: richText(text) },
  });
}

function button(text: string, classes: string[], color: string, bg: string) {
  return getTemplateRef('button', {
    classes,
    attributes: { type: 'button' },
    design: {
      typography: { isActive: true, color, fontSize: '16px', fontWeight: '600' },
      backgrounds: { isActive: true, backgroundColor: bg },
    },
    children: [
      getTemplateRef('text', {
        settings: { tag: 'span' },
        classes: [],
        design: {},
        restrictions: { editText: true },
        variables: { text: richText(text) },
      }),
    ],
  });
}

// Shared centered ad frame (fills the sized creative body).
const frame = (extra: string[]) => [
  'flex', 'flex-col', 'items-center', 'justify-center', 'text-center',
  'w-full', 'h-full', 'gap-[20px]', 'p-[72px]', 'overflow-hidden', ...extra,
];

export const creativeTemplates: Record<string, BlockTemplate> = {
  'ad-promo': {
    icon: 'zap',
    name: 'Promo / Sale',
    template: {
      name: 'div',
      customName: 'Promo ad',
      classes: frame(['bg-[#111111]']),
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '20px' },
        backgrounds: { isActive: true, backgroundColor: '#111111' },
      },
      children: [
        paragraph('LIMITED TIME', ['text-[18px]', 'font-[700]', 'tracking-[0.25em]', 'text-[#f5c542]'],
          { fontSize: '18px', fontWeight: '700', letterSpacing: '0.25', color: '#f5c542' }),
        heading('50% OFF', ['text-[128px]', 'font-[800]', 'leading-[0.95]', 'text-[#ffffff]'],
          { fontSize: '128px', fontWeight: '800', lineHeight: '0.95', color: '#ffffff' }, 'h1'),
        paragraph('Everything must go — this weekend only.', ['text-[24px]', 'text-[#d4d4d4]'],
          { fontSize: '24px', color: '#d4d4d4' }),
        button('Shop now', ['flex', 'flex-row', 'items-center', 'justify-center', 'mt-[8px]', 'h-[56px]', 'pl-[32px]', 'pr-[32px]', 'text-[18px]', 'font-[600]', 'rounded-[14px]', 'text-[#111111]', 'bg-[#f5c542]'],
          '#111111', '#f5c542'),
      ],
    },
  },

  'ad-product': {
    icon: 'image',
    name: 'Product spotlight',
    template: {
      name: 'div',
      customName: 'Product ad',
      classes: frame(['bg-[#f4f4f5]']),
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '20px' },
        backgrounds: { isActive: true, backgroundColor: '#f4f4f5' },
      },
      children: [
        paragraph('NEW ARRIVAL', ['text-[18px]', 'font-[700]', 'tracking-[0.2em]', 'text-[#6366f1]'],
          { fontSize: '18px', fontWeight: '700', letterSpacing: '0.2', color: '#6366f1' }),
        heading('Meet your new favorite', ['text-[72px]', 'font-[800]', 'leading-[1.05]', 'text-[#111111]'],
          { fontSize: '72px', fontWeight: '800', lineHeight: '1.05', color: '#111111' }, 'h1'),
        paragraph('Designed to make every day a little easier.', ['text-[24px]', 'text-[#52525b]'],
          { fontSize: '24px', color: '#52525b' }),
        button('Learn more', ['flex', 'flex-row', 'items-center', 'justify-center', 'mt-[8px]', 'h-[56px]', 'pl-[32px]', 'pr-[32px]', 'text-[18px]', 'font-[600]', 'rounded-[14px]', 'text-[#ffffff]', 'bg-[#111111]'],
          '#ffffff', '#111111'),
      ],
    },
  },

  'ad-testimonial': {
    icon: 'quote',
    name: 'Testimonial',
    template: {
      name: 'div',
      customName: 'Testimonial ad',
      classes: frame(['bg-[#ffffff]', 'gap-[28px]']),
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '28px' },
        backgrounds: { isActive: true, backgroundColor: '#ffffff' },
      },
      children: [
        paragraph('★★★★★', ['text-[36px]', 'text-[#f5c542]', 'tracking-[0.1em]'],
          { fontSize: '36px', color: '#f5c542', letterSpacing: '0.1' }),
        heading('“This completely changed how our team ships work.”',
          ['text-[52px]', 'font-[600]', 'leading-[1.2]', 'text-[#111111]'],
          { fontSize: '52px', fontWeight: '600', lineHeight: '1.2', color: '#111111' }, 'h2'),
        paragraph('— Alex Rivera, Founder at Northwind', ['text-[22px]', 'text-[#71717a]'],
          { fontSize: '22px', color: '#71717a' }),
      ],
    },
  },

  'ad-launch': {
    icon: 'zap',
    name: 'Launch / Announcement',
    template: {
      name: 'div',
      customName: 'Launch ad',
      classes: frame(['bg-gradient-to-br', 'from-[#4f46e5]', 'to-[#9333ea]', 'gap-[24px]']),
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '24px' },
        backgrounds: { isActive: true },
      },
      children: [
        paragraph('LAUNCHING SOON', ['text-[18px]', 'font-[700]', 'tracking-[0.25em]', 'text-[#e0e7ff]'],
          { fontSize: '18px', fontWeight: '700', letterSpacing: '0.25', color: '#e0e7ff' }),
        heading('Something big is coming', ['text-[76px]', 'font-[800]', 'leading-[1.05]', 'text-[#ffffff]'],
          { fontSize: '76px', fontWeight: '800', lineHeight: '1.05', color: '#ffffff' }, 'h1'),
        paragraph('Be the first to know when we go live.', ['text-[24px]', 'text-[#e0e7ff]'],
          { fontSize: '24px', color: '#e0e7ff' }),
        button('Join the waitlist', ['flex', 'flex-row', 'items-center', 'justify-center', 'mt-[8px]', 'h-[56px]', 'pl-[32px]', 'pr-[32px]', 'text-[18px]', 'font-[600]', 'rounded-[14px]', 'text-[#4f46e5]', 'bg-[#ffffff]'],
          '#4f46e5', '#ffffff'),
      ],
    },
  },
};

export const CREATIVE_TEMPLATE_KEYS = Object.keys(creativeTemplates);

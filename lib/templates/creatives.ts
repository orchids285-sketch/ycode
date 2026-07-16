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

  'ad-discount': {
    icon: 'zap',
    name: 'Discount code',
    template: {
      name: 'div',
      customName: 'Discount ad',
      classes: frame(['bg-[#fef3c7]', 'gap-[24px]']),
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '24px' },
        backgrounds: { isActive: true, backgroundColor: '#fef3c7' },
      },
      children: [
        heading('Get 20% off', ['text-[92px]', 'font-[800]', 'leading-[1]', 'text-[#111111]'],
          { fontSize: '92px', fontWeight: '800', lineHeight: '1', color: '#111111' }, 'h1'),
        paragraph('Your first order — for a limited time.', ['text-[24px]', 'text-[#78350f]'],
          { fontSize: '24px', color: '#78350f' }),
        paragraph('CODE: SAVE20',
          ['text-[26px]', 'font-[700]', 'tracking-[0.15em]', 'text-[#111111]', 'border-[2px]', 'border-dashed', 'border-[#111111]', 'rounded-[12px]', 'pt-[14px]', 'pb-[14px]', 'pl-[28px]', 'pr-[28px]'],
          { fontSize: '26px', fontWeight: '700', letterSpacing: '0.15', color: '#111111' }),
      ],
    },
  },

  'ad-event': {
    icon: 'calendar',
    name: 'Webinar / Event',
    template: {
      name: 'div',
      customName: 'Event ad',
      classes: frame(['bg-[#0f172a]', 'gap-[22px]']),
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '22px' },
        backgrounds: { isActive: true, backgroundColor: '#0f172a' },
      },
      children: [
        paragraph('FREE WEBINAR', ['text-[18px]', 'font-[700]', 'tracking-[0.25em]', 'text-[#38bdf8]'],
          { fontSize: '18px', fontWeight: '700', letterSpacing: '0.25', color: '#38bdf8' }),
        heading('Scaling ads without burning budget', ['text-[60px]', 'font-[800]', 'leading-[1.1]', 'text-[#ffffff]'],
          { fontSize: '60px', fontWeight: '800', lineHeight: '1.1', color: '#ffffff' }, 'h1'),
        paragraph('Thursday, March 14 · 11am PT', ['text-[22px]', 'text-[#cbd5e1]'],
          { fontSize: '22px', color: '#cbd5e1' }),
        button('Save my seat', ['flex', 'flex-row', 'items-center', 'justify-center', 'mt-[8px]', 'h-[56px]', 'pl-[32px]', 'pr-[32px]', 'text-[18px]', 'font-[600]', 'rounded-[14px]', 'text-[#0f172a]', 'bg-[#38bdf8]'],
          '#0f172a', '#38bdf8'),
      ],
    },
  },

  // --- Slides (16:9 presentation frames) -----------------------------------
  'slide-title': {
    icon: 'slide',
    name: 'Title slide',
    template: {
      name: 'div',
      customName: 'Title slide',
      classes: ['w-[1280px]', 'h-[720px]', 'shrink-0', 'flex', 'flex-col', 'items-center', 'justify-center', 'text-center', 'gap-[20px]', 'p-[96px]', 'bg-[#ffffff]', 'overflow-hidden', 'shadow-lg'],
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '20px' },
        backgrounds: { isActive: true, backgroundColor: '#ffffff' },
      },
      children: [
        paragraph('PRESENTATION', ['text-[20px]', 'font-[700]', 'tracking-[0.25em]', 'text-[#6366f1]'],
          { fontSize: '20px', fontWeight: '700', letterSpacing: '0.25', color: '#6366f1' }),
        heading('Your title here', ['text-[76px]', 'font-[800]', 'leading-[1.05]', 'text-[#111111]'],
          { fontSize: '76px', fontWeight: '800', lineHeight: '1.05', color: '#111111' }, 'h1'),
        paragraph('A short, punchy subtitle', ['text-[30px]', 'text-[#6b7280]'],
          { fontSize: '30px', color: '#6b7280' }),
      ],
    },
  },

  'slide-content': {
    icon: 'slide',
    name: 'Content slide',
    template: {
      name: 'div',
      customName: 'Content slide',
      classes: ['w-[1280px]', 'h-[720px]', 'shrink-0', 'flex', 'flex-col', 'justify-center', 'gap-[24px]', 'p-[96px]', 'bg-[#ffffff]', 'overflow-hidden', 'shadow-lg'],
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '24px' },
        backgrounds: { isActive: true, backgroundColor: '#ffffff' },
      },
      children: [
        heading('Slide heading', ['text-[52px]', 'font-[800]', 'leading-[1.1]', 'text-[#111111]', 'mb-[8px]'],
          { fontSize: '52px', fontWeight: '800', lineHeight: '1.1', color: '#111111' }, 'h2'),
        paragraph('•  First key point of this slide', ['text-[30px]', 'text-[#374151]'],
          { fontSize: '30px', color: '#374151' }),
        paragraph('•  Second supporting detail', ['text-[30px]', 'text-[#374151]'],
          { fontSize: '30px', color: '#374151' }),
        paragraph('•  Third takeaway to remember', ['text-[30px]', 'text-[#374151]'],
          { fontSize: '30px', color: '#374151' }),
      ],
    },
  },

  'slide-section': {
    icon: 'slide',
    name: 'Section slide',
    template: {
      name: 'div',
      customName: 'Section slide',
      classes: ['w-[1280px]', 'h-[720px]', 'shrink-0', 'flex', 'flex-col', 'justify-center', 'gap-[16px]', 'p-[96px]', 'bg-[#111111]', 'overflow-hidden', 'shadow-lg'],
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '16px' },
        backgrounds: { isActive: true, backgroundColor: '#111111' },
      },
      children: [
        paragraph('SECTION 01', ['text-[20px]', 'font-[700]', 'tracking-[0.25em]', 'text-[#818cf8]'],
          { fontSize: '20px', fontWeight: '700', letterSpacing: '0.25', color: '#818cf8' }),
        heading('Section title', ['text-[64px]', 'font-[800]', 'leading-[1.05]', 'text-[#ffffff]'],
          { fontSize: '64px', fontWeight: '800', lineHeight: '1.05', color: '#ffffff' }, 'h2'),
      ],
    },
  },
};

export const CREATIVE_TEMPLATE_KEYS = Object.keys(creativeTemplates);

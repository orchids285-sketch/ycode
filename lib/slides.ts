'use client';

/**
 * Slides / deck helpers for the Creatives editor's presentation mode.
 * A "deck" is the page body turned into a vertical stack; each "slide" is a
 * fixed 16:9 frame (a top-level child of body). Everything reuses the normal
 * layer system — updateLayerClasses / addLayerWithId / getLayerFromTemplate —
 * so slides render, select, and edit exactly like any other layer.
 */
import { usePagesStore } from '@/stores/usePagesStore';
import { getLayerFromTemplate } from '@/lib/templates/blocks';
import type { Layer } from '@/types';

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

// Body layout while in deck mode: a centered vertical stack on a neutral stage.
const DECK_CLASSES = `flex flex-col items-center gap-[48px] py-[48px] w-full min-h-full bg-[#e5e7eb]`;
const AD_SIZE_RE = /^(w-\[|h-\[|max-w-|min-w-|min-h-|max-h-|bg-|from-|to-|via-|flex|flex-|items-|justify-|gap-|py-|p-|mx-|overflow-|text-center|min-h-full)/;

function classesStr(c: string | string[] | undefined): string {
  return Array.isArray(c) ? c.join(' ') : c || '';
}

function bodyLayer(pageId: string): Layer | undefined {
  return usePagesStore.getState().draftsByPageId[pageId]?.layers?.[0];
}

export function isSlideLayer(layer: Layer): boolean {
  return /w-\[1280px\]/.test(classesStr(layer.classes));
}

export function slideCount(pageId: string): number {
  const body = bodyLayer(pageId);
  return (body?.children || []).filter(isSlideLayer).length;
}

/** Turn the body into a deck stage (strips the ad-creative sizing/bg). */
export function enableDeck(pageId: string): void {
  const body = bodyLayer(pageId);
  if (!body) return;
  const kept = classesStr(body.classes).split(/\s+/).filter(Boolean).filter((c) => !AD_SIZE_RE.test(c));
  const next = [...kept, ...DECK_CLASSES.split(' ')].join(' ').trim();
  const store = usePagesStore.getState();
  store.updateLayerClasses(pageId, body.id, next);
  void store.saveDraft(pageId);
}

/** Restore a single-creative body (leaves existing slides in place as content). */
export function disableDeck(pageId: string): void {
  const body = bodyLayer(pageId);
  if (!body) return;
  const kept = classesStr(body.classes).split(/\s+/).filter(Boolean).filter((c) => !/^bg-\[#e5e7eb\]$/.test(c));
  const store = usePagesStore.getState();
  store.updateLayerClasses(pageId, body.id, kept.join(' ').trim());
  void store.saveDraft(pageId);
}

/** Append a slide (from a slide template) to the deck. Returns its id or null. */
export function addSlide(pageId: string, templateId: 'slide-title' | 'slide-content' | 'slide-section' = 'slide-content'): string | null {
  const tree = getLayerFromTemplate(templateId);
  if (!tree) return null;
  const store = usePagesStore.getState();
  store.addLayerWithId(pageId, 'body', tree);
  void store.saveDraft(pageId);
  return tree.id;
}

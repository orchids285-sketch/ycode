/**
 * Site search index builder.
 *
 * Walks every published route (static pages, the homepage, and one entry per
 * dynamic CMS item) and flattens its resolved content into a compact
 * `SearchDocument[]`. The same index powers both the live ISR site (served
 * via `/search-index.json`) and the static HTML export (embedded inline),
 * so client-side Fuse.js search behaves identically in both.
 */

import 'server-only';

import { fetchPageByPath } from '@/lib/page-fetcher';
import { buildSlugPath } from '@/lib/page-utils';
import { getAllPages } from '@/lib/repositories/pageRepository';
import { getAllPageFolders, getAllPublishedPageFolders } from '@/lib/repositories/pageFolderRepository';
import { getValuesByFieldId } from '@/lib/repositories/collectionItemValueRepository';
import { extractPlainTextFromTiptap } from '@/lib/tiptap-utils';

import type { Layer, Page } from '@/types';

/** A single searchable entry in the site index. */
export interface SearchDocument {
  /** Root-relative URL of the page (e.g. `/about`, `/blog/my-post`). */
  url: string;
  /** Display title (SEO title, page name, or item slug). */
  title: string;
  /** SEO description, when set. */
  description?: string;
  /** Flattened body text, truncated for index size. */
  content: string;
  /** Whether the entry is a static page or a dynamic CMS item. */
  type: 'page' | 'cms';
  /** Source collection id (only for `type: 'cms'`), used for collection-scoped search. */
  collection?: string;
}

/** Max characters of body text kept per document to keep the index small. */
const MAX_CONTENT_LENGTH = 5000;

/**
 * Recursively flatten a resolved layer tree into a single plain-text string,
 * pulling text variables (plain + Tiptap rich text) and image alt text.
 */
function flattenLayersText(layers: Layer[] | undefined): string {
  if (!layers || layers.length === 0) return '';

  const parts: string[] = [];

  const visit = (layer: Layer): void => {
    const textVar = layer.variables?.text;
    if (textVar?.type === 'dynamic_text' && typeof textVar.data?.content === 'string') {
      parts.push(stripTags(textVar.data.content));
    } else if (textVar?.type === 'dynamic_rich_text' && textVar.data?.content) {
      parts.push(extractPlainTextFromTiptap(textVar.data.content));
    }

    const alt = layer.variables?.image?.alt;
    if (alt?.type === 'dynamic_text' && typeof alt.data?.content === 'string') {
      parts.push(stripTags(alt.data.content));
    }

    if (layer.children) layer.children.forEach(visit);
  };

  layers.forEach(visit);

  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_CONTENT_LENGTH);
}

/** Strip HTML/inline-variable tags so resolved plain-text content stays clean. */
function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ');
}

interface PageSeo {
  title?: string | null;
  description?: string | null;
}

function extractSeo(page: Page): PageSeo {
  return (page.settings as { seo?: PageSeo } | undefined)?.seo ?? {};
}

/** Build a `SearchDocument` for an already-resolved route, or null if empty. */
function buildDocument(
  page: Page,
  layers: Layer[] | undefined,
  url: string,
  type: SearchDocument['type'],
  options: { fallbackTitle?: string; collection?: string } = {},
): SearchDocument | null {
  // Skip error pages (resolved via slug collisions) and noindex pages,
  // mirroring the sitemap's exclusion signals.
  if (page.error_page != null) return null;

  const seo = extractSeo(page);
  if ((seo as { noindex?: boolean }).noindex) return null;

  const title = (seo.title || options.fallbackTitle || page.name || '').trim();
  const content = flattenLayersText(layers);

  if (!title && !content) return null;

  const doc: SearchDocument = {
    url: url.startsWith('/') ? url : `/${url}`,
    title: title || url,
    content,
    type,
  };
  if (seo.description) doc.description = seo.description.trim();
  if (options.collection) doc.collection = options.collection;

  return doc;
}

/**
 * Build the full search index for a locale.
 *
 * @param opts.localeCode - Non-default locale code to prefix routes with so
 *   `fetchPageByPath` resolves localized content. Omit for the default locale.
 * @param opts.published - Index published (default) or draft content. Draft is
 *   used by the preview to mirror unsaved edits.
 * @param opts.tenantId - Threaded to data fetchers for multi-tenant deployments.
 */
export async function buildSearchIndex(
  opts: { localeCode?: string; published?: boolean; tenantId?: string } = {},
): Promise<SearchDocument[]> {
  const { localeCode, tenantId, published = true } = opts;
  const prefix = localeCode ? `${localeCode}/` : '';

  const [pages, folders] = await Promise.all([
    getAllPages({ is_published: published }),
    published ? getAllPublishedPageFolders() : getAllPageFolders({ is_published: false }),
  ]);

  // Skip error pages (401/404/500) and soft-deleted pages.
  const validPages = pages.filter((p) => p.error_page == null && p.deleted_at == null);

  const documents: SearchDocument[] = [];

  for (const page of validPages) {
    try {
      if (page.is_dynamic) {
        await indexDynamicPage(page, folders, prefix, published, tenantId, documents);
      } else {
        await indexStaticPage(page, folders, prefix, localeCode, published, tenantId, documents);
      }
    } catch (error) {
      console.error(`[search-index] Failed to index page "${page.name}" (${page.id}):`, error);
    }
  }

  return documents;
}

/** Resolve and index a single static page (or the homepage). */
async function indexStaticPage(
  page: Page,
  folders: Awaited<ReturnType<typeof getAllPublishedPageFolders>>,
  prefix: string,
  localeCode: string | undefined,
  published: boolean,
  tenantId: string | undefined,
  documents: SearchDocument[],
): Promise<void> {
  const isHome = page.is_index && page.page_folder_id === null;
  const basePath = isHome ? '' : buildSlugPath(page, folders, 'page').replace(/^\/+/, '');
  const slugPath = `${prefix}${basePath}`;

  const data = await fetchPageByPath(slugPath, published, undefined, tenantId);
  if (!data?.pageLayers?.layers) return;

  const url = isHome
    ? (localeCode ? `/${localeCode}` : '/')
    : `/${slugPath}`;

  const doc = buildDocument(data.page, data.pageLayers.layers, url, 'page');
  if (doc) documents.push(doc);
}

/** Resolve and index every item of a dynamic CMS page. */
async function indexDynamicPage(
  page: Page,
  folders: Awaited<ReturnType<typeof getAllPublishedPageFolders>>,
  prefix: string,
  published: boolean,
  tenantId: string | undefined,
  documents: SearchDocument[],
): Promise<void> {
  const cms = page.settings?.cms;
  if (!cms?.collection_id || !cms.slug_field_id) return;

  const slugValues = await getValuesByFieldId(cms.slug_field_id, published);
  const pattern = buildSlugPath(page, folders, 'page', '{slug}');

  for (const row of slugValues) {
    const itemSlug = typeof row.value === 'string' ? row.value : String(row.value ?? '');
    if (!itemSlug) continue;

    const basePath = pattern.replace(/\{slug\}/g, itemSlug).replace(/^\/+/, '');
    const slugPath = `${prefix}${basePath}`;

    const data = await fetchPageByPath(slugPath, published, undefined, tenantId);
    if (!data?.pageLayers?.layers) continue;

    const doc = buildDocument(data.page, data.pageLayers.layers, `/${slugPath}`, 'cms', {
      fallbackTitle: itemSlug,
      collection: cms.collection_id,
    });
    if (doc) documents.push(doc);
  }
}

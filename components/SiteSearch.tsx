'use client';

/**
 * SiteSearch
 *
 * Runtime behavior for the `siteSearch` element on published & preview pages.
 * Opens a Quick Menu (command-palette) overlay on trigger click or the
 * ⌘K / Ctrl+K shortcut, lazy-loads Fuse.js + the prebuilt `/search-index.json`
 * on first open, and renders ranked results that link to each page.
 *
 * Lives in its own module so Fuse.js and the overlay UI only ship on pages
 * that actually render a search element. Loaded lazily via `next/dynamic`
 * from `LayerRendererPublic`. The static export mirrors this with a vanilla
 * boot script (see `lib/apps/static-export/document.ts`).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { SearchDocument } from '@/lib/search/build-search-index';
import type { SiteSearchSettings } from '@/types';

interface SiteSearchProps {
  triggerRef: React.RefObject<HTMLElement | null>;
  settings: SiteSearchSettings;
  isPreview?: boolean;
}

const MAX_RESULTS = 8;

/** Builder preview path prefix — preview pages live under this route. */
const PREVIEW_PREFIX = '/ycode/preview';

/** Restrict the index to the element's configured scope. */
function applyScope(documents: SearchDocument[], settings: SiteSearchSettings): SearchDocument[] {
  if (settings.scope === 'paths' && settings.paths?.length) {
    const prefixes = settings.paths.map((p) => (p.startsWith('/') ? p : `/${p}`));
    return documents.filter((doc) => prefixes.some((prefix) => doc.url.startsWith(prefix)));
  }
  if (settings.scope === 'collection' && settings.collectionId) {
    return documents.filter((doc) => doc.collection === settings.collectionId);
  }
  return documents;
}

const SiteSearch: React.FC<SiteSearchProps> = ({ triggerRef, settings, isPreview = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState<SearchDocument[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const fuseRef = useRef<any>(null);

  useEffect(() => setMounted(true), []);

  // Map an index URL (always production-relative) to the actual href. In the
  // builder preview, results must point at the draft routes under /ycode/preview.
  const resolveHref = useCallback(
    (url: string): string => {
      if (!isPreview) return url;
      return url === '/' ? PREVIEW_PREFIX : `${PREVIEW_PREFIX}${url}`;
    },
    [isPreview],
  );

  // Load Fuse.js + the search index once, on first open.
  const loadIndex = useCallback(async () => {
    if (documents) return;
    setLoading(true);
    try {
      const localeCode = typeof document !== 'undefined' ? document.documentElement.lang : '';
      const params = new URLSearchParams();
      if (localeCode) params.set('locale', localeCode);
      if (isPreview) params.set('preview', '1');
      const queryString = params.toString();
      const [{ default: Fuse }, res] = await Promise.all([
        import('fuse.js'),
        fetch(`/search-index.json${queryString ? `?${queryString}` : ''}`),
      ]);
      const data = await res.json();
      const scoped = applyScope((data.documents ?? []) as SearchDocument[], settings);
      fuseRef.current = new Fuse(scoped, {
        keys: [
          { name: 'title', weight: 3 },
          { name: 'description', weight: 2 },
          { name: 'content', weight: 1 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
      });
      setDocuments(scoped);
    } catch (error) {
      console.error('[SiteSearch] Failed to load search index:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [documents, settings, isPreview]);

  const open = useCallback(() => {
    setIsOpen(true);
    loadIndex();
  }, [loadIndex]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  // Wire the trigger element + the ⌘K / Ctrl+K shortcut.
  useEffect(() => {
    const trigger = triggerRef.current;
    const handleTriggerClick = (e: Event) => {
      e.preventDefault();
      open();
    };
    trigger?.addEventListener('click', handleTriggerClick);

    const handleShortcut = (e: KeyboardEvent) => {
      if (settings.shortcut !== false && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    };
    document.addEventListener('keydown', handleShortcut);

    return () => {
      trigger?.removeEventListener('click', handleTriggerClick);
      document.removeEventListener('keydown', handleShortcut);
    };
  }, [triggerRef, open, settings.shortcut]);

  // Focus the input + lock body scroll while the overlay is open.
  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const results = useMemo<SearchDocument[]>(() => {
    if (!fuseRef.current || !query.trim()) return [];
    return fuseRef.current.search(query.trim(), { limit: MAX_RESULTS }).map((r: any) => r.item as SearchDocument);
  }, [query]);

  useEffect(() => setActiveIndex(0), [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      window.location.href = resolveHref(results[activeIndex].url);
    }
  };

  if (!mounted || !isOpen) return null;

  const placeholder = settings.placeholder || 'Search...';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Site search"
      onMouseDown={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '12vh 16px 16px',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          maxWidth: 560,
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 16px 48px rgba(0,0,0,0.24)',
          overflow: 'hidden',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #ededed' }}>
          <svg
            width="18" height="18"
            viewBox="0 0 20 20" fill="#9ca3af"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
              clipRule="evenodd"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 16,
              color: '#171717',
              background: 'transparent',
            }}
          />
          <kbd style={{ fontSize: 11, color: '#9ca3af', border: '1px solid #e5e5e5', borderRadius: 6, padding: '2px 6px' }}>
            Esc
          </kbd>
        </div>

        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '16px', fontSize: 14, color: '#9ca3af' }}>Loading…</div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div style={{ padding: '16px', fontSize: 14, color: '#9ca3af' }}>
              No results for “{query.trim()}”
            </div>
          )}
          {!loading && results.map((doc, index) => (
            <a
              key={doc.url}
              href={resolveHref(doc.url)}
              onMouseEnter={() => setActiveIndex(index)}
              style={{
                display: 'block',
                padding: '10px 16px',
                textDecoration: 'none',
                background: index === activeIndex ? '#f5f5f5' : 'transparent',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: '#171717' }}>{doc.title}</div>
              {(doc.description || doc.content) && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#737373',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {doc.description || doc.content}
                </div>
              )}
            </a>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SiteSearch;

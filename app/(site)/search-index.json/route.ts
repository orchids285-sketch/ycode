/**
 * Site search index route.
 *
 * Serves the client-side search index consumed by the Site Search element's
 * Quick Menu. Rebuilt only when the site is published (cache keyed on
 * `published_at`) and cached per locale.
 */

import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

import { credentials } from '@/lib/credentials';
import { buildSearchIndex, type SearchDocument } from '@/lib/search/build-search-index';
import { getAllLocales } from '@/lib/repositories/localeRepository';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Resolve the search index for a locale. Production caches indefinitely (the
 * key includes the publish timestamp and the publish pipeline busts the
 * `search-index` tag). Development uses a short TTL so the index reflects code
 * and content changes within seconds, while still reusing the expensive
 * full-site build across rapid requests to avoid hammering the database.
 */
const getCachedIndex = unstable_cache(
  async (localeCode: string | undefined, _publishedAt: string): Promise<SearchDocument[]> => {
    return buildSearchIndex({ localeCode });
  },
  ['search-index'],
  { revalidate: IS_PRODUCTION ? false : 10, tags: ['search-index'] },
);

export async function GET(request: Request) {
  try {
    const hasSupabaseCredentials = await credentials.exists();
    if (!hasSupabaseCredentials) {
      return NextResponse.json({ documents: [] });
    }

    const searchParams = new URL(request.url).searchParams;
    const requestedLocale = searchParams.get('locale')?.trim() || '';
    const isPreview = searchParams.get('preview') === '1';

    // Only prefix routes for a published, non-default locale; everything else
    // resolves the default locale (no prefix).
    let localeCode: string | undefined;
    if (requestedLocale) {
      const locales = await getAllLocales(true);
      const match = locales.find((l) => l.code === requestedLocale);
      if (match && !match.is_default) localeCode = match.code;
    }

    // Preview indexes draft content and must never be cached — it mirrors
    // unsaved edits and is consumed only inside the builder preview.
    if (isPreview) {
      const documents = await buildSearchIndex({ localeCode, published: false });
      return NextResponse.json(
        { documents },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const publishedAt = (await getSettingByKey('published_at')) || 'never';
    const documents = await getCachedIndex(localeCode, String(publishedAt));

    // Cache aggressively: the index only changes on publish, which busts the
    // `search-index` tag and the published_at-keyed data cache. stale-while-
    // revalidate lets clients serve instantly while refreshing in the background.
    return NextResponse.json(
      { documents },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400',
        },
      },
    );
  } catch (error) {
    console.error('[search-index] Error generating search index:', error);
    return NextResponse.json({ documents: [] }, { status: 500 });
  }
}

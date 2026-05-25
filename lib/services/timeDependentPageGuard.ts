import { unstable_cache } from 'next/cache';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { PAGES_WITH_DATE_PRESETS_SETTING } from '@/lib/services/datePresetsService';

/**
 * Helpers for tagging cache entries that depend on date presets (`$today`,
 * `$this_week`, ...). Pulled into its own module so every public page route
 * (force-dynamic + ISR in cloud) can reuse the same membership check
 * without copy-pasting the `unstable_cache` wrapper.
 *
 * `tenantId` is threaded through for parity with the cloud overlay —
 * ignored in opensource, used in cloud to scope `getSettingByKey` and the
 * `unstable_cache` keys/tags per tenant.
 */

/**
 * Returns the cached set of published page IDs whose render evaluates a
 * date preset.
 */
export async function getCachedTimeDependentPageIds(tenantId?: string): Promise<string[]> {
  try {
    return await unstable_cache(
      async () => {
        const value = await getSettingByKey(PAGES_WITH_DATE_PRESETS_SETTING, tenantId);
        return Array.isArray(value) ? (value as string[]) : [];
      },
      ['data-for-time-dependent-page-ids', `tenant:${tenantId || 'none'}`],
      {
        tags: tenantId ? [`tenant-${tenantId}`] : ['all-pages'],
        revalidate: false,
      },
    )();
  } catch {
    return [];
  }
}

/**
 * Resolves whether the page returned by `fetchMetadata` is in the
 * time-dependent set. The caller passes its own metadata fetcher so each
 * route can reuse its already-cached metadata call (the parallel pair
 * adds zero round trips once both caches are warm).
 */
export async function isTimeDependentBySlug(
  fetchMetadata: () => Promise<{ page: { id: string } } | null>,
  tenantId?: string,
): Promise<boolean> {
  try {
    const [ids, meta] = await Promise.all([
      getCachedTimeDependentPageIds(tenantId),
      fetchMetadata(),
    ]);
    if (ids.length === 0 || !meta) return false;
    return ids.includes(meta.page.id);
  } catch {
    return false;
  }
}

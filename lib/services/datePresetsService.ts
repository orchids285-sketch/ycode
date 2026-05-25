import { getSettingByKey, setSetting } from '@/lib/repositories/settingsRepository';
import { getPublishedLayersByIds } from '@/lib/repositories/pageLayersRepository';
import { getAllComponents } from '@/lib/repositories/componentRepository';
import { getRoutePathsForPages, invalidateTimeDependentPages } from '@/lib/services/cacheService';
import { pageHasDatePresets } from '@/lib/date-presets-detector';
import type { Component } from '@/types';

/** Setting key storing the list of published page IDs whose render depends on a date preset. */
export const PAGES_WITH_DATE_PRESETS_SETTING = 'pages_with_date_presets';

/**
 * Setting key storing the slug paths (no leading slash, locale-prefixed where
 * applicable, dynamic-page item paths enumerated) for every time-dependent
 * page. Lets the proxy do a cheap path-membership check without an extra
 * page lookup per request.
 */
export const PAGES_WITH_DATE_PRESET_PATHS_SETTING = 'pages_with_date_preset_paths';

/**
 * Setting key storing the last site-local date (YYYY-MM-DD) at which
 * time-dependent pages were invalidated. Compared against today in the
 * site's timezone to drive at-most-once-per-day lazy rollover.
 */
export const LAST_DATE_PRESET_ROLLOVER_SETTING = 'last_date_preset_rollover';

/**
 * Returns the currently stored list of page IDs flagged as time-dependent.
 * Tolerates an unset or malformed value by returning an empty array.
 */
export async function getTimeDependentPageIds(): Promise<string[]> {
  const value = await getSettingByKey(PAGES_WITH_DATE_PRESETS_SETTING);
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

/**
 * Returns the currently stored list of slug paths for time-dependent pages.
 * Used by the proxy to decide whether a request needs the rollover check.
 */
export async function getTimeDependentPagePaths(): Promise<string[]> {
  const value = await getSettingByKey(PAGES_WITH_DATE_PRESET_PATHS_SETTING);
  return Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string') : [];
}

/** Returns the stored last-rollover marker (`YYYY-MM-DD`) or `null` if never set. */
export async function getLastDatePresetRollover(): Promise<string | null> {
  const value = await getSettingByKey(LAST_DATE_PRESET_ROLLOVER_SETTING);
  return typeof value === 'string' ? value : null;
}

/** Persists the rollover marker so subsequent visits within the day skip invalidation. */
export async function setLastDatePresetRollover(date: string): Promise<void> {
  await setSetting(LAST_DATE_PRESET_ROLLOVER_SETTING, date);
}

/**
 * Incrementally update the stored list of time-dependent page IDs after a publish.
 * Re-scans only the pages that changed (directly or indirectly) and toggles their
 * membership based on whether their published layers still reference a date preset.
 * Pages outside `affectedPageIds` keep their existing flag — they weren't republished.
 */
export async function recomputeTimeDependentPageIds(
  affectedPageIds: string[],
): Promise<{ added: string[]; removed: string[]; total: number }> {
  if (affectedPageIds.length === 0) {
    const existing = await getTimeDependentPageIds();
    return { added: [], removed: [], total: existing.length };
  }

  // Load published layers for the affected pages and all components in one shot.
  // Components are loaded in full because a preset can live in any variant tree
  // that a layer references via componentId.
  const [layersByPage, components] = await Promise.all([
    getPublishedLayersByIds(affectedPageIds),
    getAllComponents(true),
  ]);

  const componentsById = new Map<string, Component>();
  for (const component of components) componentsById.set(component.id, component);

  const existing = new Set(await getTimeDependentPageIds());
  const added: string[] = [];
  const removed: string[] = [];

  for (const pageId of affectedPageIds) {
    const layers = layersByPage.find(l => l.page_id === pageId)?.layers ?? [];
    const isTimeDependent = pageHasDatePresets(layers, componentsById);

    if (isTimeDependent && !existing.has(pageId)) {
      existing.add(pageId);
      added.push(pageId);
    } else if (!isTimeDependent && existing.has(pageId)) {
      existing.delete(pageId);
      removed.push(pageId);
    }
  }

  const idsChanged = added.length > 0 || removed.length > 0;
  const updatedIds = [...existing];

  if (idsChanged) {
    await setSetting(PAGES_WITH_DATE_PRESETS_SETTING, updatedIds);
  }

  // Resolve to slug paths so the proxy can do a cheap string-set membership
  // check without an extra page lookup. Includes locale variants and
  // dynamic-page item paths (one entry per published CMS item) — so we
  // rewrite paths whenever any affected page is already time-dependent,
  // even if the ID set itself didn't change (a CMS item publish changes
  // the path enumeration of the dynamic page without flipping any flags).
  const touchedExistingTimeDependent = affectedPageIds.some(id => existing.has(id));
  if (idsChanged || touchedExistingTimeDependent) {
    const updatedPaths = updatedIds.length > 0 ? await getRoutePathsForPages(updatedIds) : [];
    await setSetting(PAGES_WITH_DATE_PRESET_PATHS_SETTING, updatedPaths);
  }

  return { added, removed, total: existing.size };
}

/**
 * Returns the current calendar date (`YYYY-MM-DD`) in the given IANA timezone.
 * Falls back to the UTC date if the timezone string is unrecognised.
 */
export function getDateInTimezone(timezone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fall through to UTC.
  }
  return now.toISOString().slice(0, 10);
}

/**
 * Lazy daily rollover trigger called from the proxy on visits to time-dependent
 * pages. Reads the site timezone, compares today's date against the stored
 * marker, and — only on day rollover — invalidates the `time-dependent-pages`
 * tag and updates the marker.
 *
 * Designed to be safe to call from `waitUntil()`: the visitor's response is
 * served from cache (yesterday's HTML) while invalidation runs in the
 * background; the next visitor gets a cache MISS and the fresh render.
 */
export async function maybeRolloverDatePresets(): Promise<{
  rolledOver: boolean;
  date: string;
  previous: string | null;
}> {
  const timezone = ((await getSettingByKey('timezone')) as string | null) || 'UTC';
  const today = getDateInTimezone(timezone);
  const previous = await getLastDatePresetRollover();

  if (previous === today) {
    return { rolledOver: false, date: today, previous };
  }

  await invalidateTimeDependentPages();
  await setLastDatePresetRollover(today);

  return { rolledOver: true, date: today, previous };
}

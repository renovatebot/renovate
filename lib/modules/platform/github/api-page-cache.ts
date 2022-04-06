import { DateTime } from 'luxon';
import type { ApiPageCache, ApiPageItem } from './types';

export function getItem<T extends ApiPageItem>(
  cache: ApiPageCache<T>,
  number: number
): T | null {
  return cache.items[number] ?? null;
}

/**
 * It intentionally doesn't alter `lastUpdated` cache field.
 *
 * The point is to allow cache modifications during run, but
 * force fetch and refresh modified items in the next run.
 */
export function setItem<T extends ApiPageItem>(
  cache: ApiPageCache<T>,
  item: T
): void {
  cache.items[item.number] = item;
}

/**
 * Copies items from `page` to `cache`.
 * Updates internal cache timestamp.
 *
 * @param cache Cache object
 * @param page List of cacheable items, sorted by `updated_at` field
 * starting from the most recently updated.
 * @returns `true` when the next page is likely to contain fresh items,
 * otherwise `false`.
 */
export function reconcileWithPage<T extends ApiPageItem>(
  cache: ApiPageCache<T>,
  page: T[]
): boolean {
  const { items } = cache;
  let { lastUpdated } = cache;

  let needNextPage = true;

  for (const newItem of page) {
    const number = newItem.number;
    const oldItem = items[number];

    const itemNewTime = DateTime.fromISO(newItem.updated_at);
    const itemOldTime = oldItem?.updated_at
      ? DateTime.fromISO(oldItem.updated_at)
      : null;

    items[number] = newItem;

    needNextPage = itemOldTime ? itemOldTime < itemNewTime : true;

    const cacheOldTime = lastUpdated ? DateTime.fromISO(lastUpdated) : null;
    if (!cacheOldTime || itemNewTime > cacheOldTime) {
      lastUpdated = newItem.updated_at;
    }
  }

  cache.lastUpdated = lastUpdated;

  return needNextPage;
}

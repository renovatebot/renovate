import { DateTime } from 'luxon';
import type { RestPageCache, RestPageItem } from './types';

export function getEmptyCache<T extends RestPageItem>(): RestPageCache<T> {
  return {
    items: {},
    timestamp: DateTime.fromISO('1900-01-01').toISO(),
    etag: '',
  };
}

export function getItem<T extends RestPageItem>(
  cache: RestPageCache<T>,
  number: number
): T | null {
  return cache.items[number] ?? null;
}

export function setItem<T extends RestPageItem>(
  cache: RestPageCache<T>,
  item: T
): void {
  cache.items[item.number] = item;
}

/**
 * Copies items from `page` to `cache`.
 * Updates internal cache timestamp.
 *
 * @param cache Cache object
 * @param page List of cacheable items, sorted by `updated_at` field.
 * @returns `true` when all page items are new. In this case, we assume
 * next page to contain contain new items too. Otherwise, returns `false`
 * meaning some of page items are updated earlier than cache timestamp,
 * so that we conclude all the "fresh" items are fetched.
 */
export function reconcileWithPage<T extends RestPageItem>(
  cache: RestPageCache<T>,
  page: T[]
): boolean {
  const { items, timestamp } = cache;

  const oldTimestamp = DateTime.fromISO(timestamp);
  let newTimestamp = oldTimestamp;

  let needNextPage = true;

  for (const item of page) {
    const itemTimestamp = DateTime.fromISO(item.updated_at);

    items[item.number] = item;

    if (oldTimestamp >= itemTimestamp) {
      needNextPage = false;
    }

    if (itemTimestamp > newTimestamp) {
      newTimestamp = itemTimestamp;
    }
  }

  cache.timestamp = newTimestamp.toISO();

  return needNextPage;
}

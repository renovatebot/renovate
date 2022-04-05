import { DateTime } from 'luxon';
import type { CacheableItem, ListCache } from './types';

export function getEmptyCache<T extends CacheableItem>(): ListCache<T> {
  return {
    items: {},
    timestamp: DateTime.fromISO('1900-01-01').toISO(),
    etag: '',
  };
}

export function getItem<T extends CacheableItem>(
  cache: ListCache<T>,
  number: number
): T | null {
  return cache.items[number] ?? null;
}

export function setItem<T extends CacheableItem>(
  cache: ListCache<T>,
  item: T
): void {
  cache.items[item.number] = item;
}

export function reconcileWithPage<T extends CacheableItem>(
  cache: ListCache<T>,
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

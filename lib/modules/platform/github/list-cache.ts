import { DateTime } from 'luxon';
import type { CacheableItem, ListCache } from './types';

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
): void {
  const { items, timestamp } = cache;

  const oldTimestamp = DateTime.fromISO(timestamp);
  let newTimestamp = oldTimestamp;

  for (const item of page) {
    const itemTimestamp = DateTime.fromISO(item.updated_at);

    if (itemTimestamp > oldTimestamp) {
      items[item.number] = item;
    }

    if (itemTimestamp > newTimestamp) {
      newTimestamp = itemTimestamp;
    }
  }

  cache.timestamp = newTimestamp.toISO();
}

import { DateTime } from 'luxon';
import type { ApiPageCache, ApiPageItem } from './types';

export class ApiCache<T extends ApiPageItem> {
  constructor(private cache: ApiPageCache<T>) {}

  lastUpdated(): string | undefined {
    return this.cache.lastUpdated;
  }

  getItems(): T[] {
    return Object.values(this.cache.items);
  }

  getItem(number: number): T | null {
    return this.cache.items[number] ?? null;
  }

  /**
   * It intentionally doesn't alter `lastUpdated` cache field.
   *
   * The point is to allow cache modifications during run, but
   * force fetching and refreshing of modified items next run.
   */
  updateItem(item: T): void {
    this.cache.items[item.number] = item;
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
  reconcile(page: T[]): boolean {
    const { items } = this.cache;
    let { lastUpdated } = this.cache;

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

    this.cache.lastUpdated = lastUpdated;

    return needNextPage;
  }
}

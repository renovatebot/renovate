import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import type { ApiPageCache, ApiPageItem } from './types';

export class ApiCache<T extends ApiPageItem> {
  constructor(private cache: ApiPageCache<T>) {}

  /**
   * @returns Date formatted to use in HTTP headers
   */
  get lastModified(): string | null {
    const { lastModified } = this.cache;
    return lastModified ? DateTime.fromISO(lastModified).toHTTP() : null;
  }

  getItems(): T[] {
    const items = Object.values(this.cache.items);
    return items;
  }

  getItem(number: number): T | null {
    return this.cache.items[number] ?? null;
  }

  /**
   * It intentionally doesn't alter `lastModified` cache field.
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
    let { lastModified } = this.cache;

    let needNextPage = true;

    for (const newItem of page) {
      const number = newItem.number;
      const oldItem = items[number];

      const itemNewTime = DateTime.fromISO(newItem.updated_at);
      const itemOldTime = oldItem?.updated_at
        ? DateTime.fromISO(oldItem.updated_at)
        : null;

      if (!dequal(oldItem, newItem)) {
        items[number] = newItem;
      }

      needNextPage = itemOldTime ? itemOldTime < itemNewTime : true;

      const cacheOldTime = lastModified ? DateTime.fromISO(lastModified) : null;
      if (!cacheOldTime || itemNewTime > cacheOldTime) {
        lastModified = newItem.updated_at;
      }
    }

    this.cache.lastModified = lastModified;

    return needNextPage;
  }
}

import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import type { ApiPageCache, ApiPageItem } from './types';

export class ApiCache<T extends ApiPageItem> {
  private itemsMapCache = new WeakMap();

  constructor(private cache: ApiPageCache<T>) {}

  get etag(): string | null {
    return this.cache.etag ?? null;
  }

  set etag(value: string | null) {
    if (value === null) {
      delete this.cache.etag;
    } else {
      this.cache.etag = value;
    }
  }

  /**
   * @returns Date formatted to use in HTTP headers
   */
  get lastModified(): string | null {
    const { lastModified } = this.cache;
    return lastModified ? DateTime.fromISO(lastModified).toHTTP() : null;
  }

  getItems(): T[];
  getItems<U = unknown>(mapFn: (T) => U): U[];
  getItems<U = unknown>(mapFn?: (T) => U): T[] | U[] {
    if (mapFn) {
      const cachedResult = this.itemsMapCache.get(mapFn);
      if (cachedResult) {
        return cachedResult;
      }

      const items = Object.values(this.cache.items);
      const mappedResult = items.map(mapFn);
      this.itemsMapCache.set(mapFn, mappedResult);
      return mappedResult;
    }

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
    this.itemsMapCache = new WeakMap();
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
        this.itemsMapCache = new WeakMap();
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

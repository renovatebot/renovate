import { dequal } from 'dequal';
import { logger } from '../../../logger';
import type { ApiPageCache, ApiPageItem } from './types';

export class ApiCache<T extends ApiPageItem> {
  constructor(private cache: ApiPageCache<T>) {}

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
   * @returns `false` when the next page is guaranteed to not have any updates.
   */
  reconcile(page: T[]): boolean {
    const { items } = this.cache;

    let needNextPage = true;

    for (const newItem of page) {
      const number = newItem.number;
      const oldItem = items[number];

      if (dequal(oldItem, newItem)) {
        logger.trace(`PR cache: sync termination triggered by PR #${number}`);
        needNextPage = false;
        continue;
      }

      logger.trace(`PR cache: updating PR #${number}`);
      items[number] = newItem;
    }

    return needNextPage;
  }

  get lastModified(): string | undefined {
    return this.cache.lastModified;
  }

  set lastModified(value: string) {
    this.cache.lastModified = value;
  }
}

import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import * as packageCache from '../../../util/cache/package';
import type { DockerHubTag } from './schema';

export interface DockerHubCacheData {
  items: Record<number, DockerHubTag>;
  updatedAt: string | null;
}

const cacheNamespace = 'datasource-docker-hub-cache';

export class DockerHubCache {
  private isChanged = false;
  private reconciledIds = new Set<number>();

  private constructor(
    private dockerRepository: string,
    private cache: DockerHubCacheData,
  ) {}

  static async init(dockerRepository: string): Promise<DockerHubCache> {
    let repoCache = await packageCache.get<DockerHubCacheData>(
      cacheNamespace,
      dockerRepository,
    );

    repoCache ??= {
      items: {},
      updatedAt: null,
    };

    return new DockerHubCache(dockerRepository, repoCache);
  }

  reconcile(items: DockerHubTag[], expectedCount: number): boolean {
    let needNextPage = true;

    let earliestDate = null;

    let { updatedAt } = this.cache;
    let latestDate = updatedAt ? DateTime.fromISO(updatedAt) : null;

    for (const newItem of items) {
      const id = newItem.id;
      this.reconciledIds.add(id);

      const oldItem = this.cache.items[id];

      const itemDate = DateTime.fromISO(newItem.last_updated);

      if (!earliestDate || earliestDate > itemDate) {
        earliestDate = itemDate;
      }

      if (!latestDate || latestDate < itemDate) {
        latestDate = itemDate;
        updatedAt = newItem.last_updated;
      }

      if (dequal(oldItem, newItem)) {
        needNextPage = false;
        continue;
      }

      this.cache.items[newItem.id] = newItem;
      this.isChanged = true;
    }

    this.cache.updatedAt = updatedAt;

    if (earliestDate && latestDate) {
      for (const [key, item] of Object.entries(this.cache.items)) {
        const id = parseInt(key);

        const itemDate = DateTime.fromISO(item.last_updated);

        if (
          itemDate < earliestDate ||
          itemDate > latestDate ||
          this.reconciledIds.has(id)
        ) {
          continue;
        }

        delete this.cache.items[id];
        this.isChanged = true;
      }

      if (Object.keys(this.cache.items).length > expectedCount) {
        return true;
      }
    }

    return needNextPage;
  }

  async save(): Promise<void> {
    if (this.isChanged) {
      await packageCache.set(
        cacheNamespace,
        this.dockerRepository,
        this.cache,
        3 * 60 * 24 * 30,
      );
    }
  }

  getItems(): DockerHubTag[] {
    return Object.values(this.cache.items);
  }
}

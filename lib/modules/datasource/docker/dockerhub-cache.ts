import { dequal } from 'dequal';
import * as packageCache from '../../../util/cache/package';
import { UtcDate } from '../../../util/schema-utils';
import type { DockerHubTag } from './schema';

export interface DockerHubCacheData {
  items: Record<number, DockerHubTag>;
  updatedAt: string | null;
}

const cacheNamespace = 'datasource-docker-hub-cache';

export class DockerHubCache {
  private isChanged = false;

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

  reconcile(items: DockerHubTag[]): boolean {
    let needNextPage = true;

    let { updatedAt } = this.cache;
    let latestDate = UtcDate.nullable().catch(null).parse(updatedAt);

    for (const newItem of items) {
      const id = newItem.id;
      const oldItem = this.cache.items[id];

      if (dequal(oldItem, newItem)) {
        needNextPage = false;
        continue;
      }

      this.cache.items[newItem.id] = newItem;
      const newItemDate = UtcDate.parse(newItem.last_updated);
      if (!latestDate || latestDate < newItemDate) {
        updatedAt = newItem.last_updated;
        latestDate = newItemDate;
      }

      this.isChanged = true;
    }

    this.cache.updatedAt = updatedAt;
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

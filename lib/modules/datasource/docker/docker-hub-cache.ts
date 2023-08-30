import { DateTime } from 'luxon';
import { z } from 'zod';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import type { Http } from '../../../util/http';
import { LooseArray } from '../../../util/schema-utils';
import type { Release } from '../types';

interface DockerHubRelease {
  version: string;
  newDigest: string;
  releaseTimestamp?: string;
}

const DockerHubTag = z
  .object({
    id: z.number().transform((id) => id.toString()),
    name: z.string(),
    digest: z.string(),
    tag_last_pushed: z.string().optional(),
  })
  .transform(
    ({
      id,
      name,
      digest,
      tag_last_pushed,
    }): { id: string; release: DockerHubRelease } => {
      const release: DockerHubRelease = {
        version: name,
        newDigest: digest,
      };

      if (tag_last_pushed) {
        release.releaseTimestamp = tag_last_pushed;
      }

      return { id, release };
    }
  );
type DockerHubTag = z.infer<typeof DockerHubTag>;

const DockerHubTagsPage = z
  .object({
    next: z.string().nullable(),
    results: LooseArray(DockerHubTag, {
      onError: /* istanbul ignore next */ ({ error, input: tags }) => {
        logger.debug(
          { error, input: tags },
          'Docker: Failed to parse some tags from Docker Hub'
        );
      },
    }),
  })
  .transform(({ next, results }) => ({
    nextPage: next,
    items: results,
  }));

type DockerHubCacheRecord = {
  lastModified: string;
  releases: Record<string, DockerHubRelease>;
};

export class DockerHubCache {
  private persistData = false;

  constructor(
    private http: Http,
    private packageName: string,
    private randomDeltaDays = 30
  ) {}

  static cacheNs = `dockerhub-incremental-cache`;

  private async getCache(): Promise<DockerHubCacheRecord> {
    const cache = await packageCache.get<DockerHubCacheRecord>(
      DockerHubCache.cacheNs,
      this.packageName
    );
    return (
      cache ?? {
        lastModified: '2000-01-01T00:00:00.000Z',
        releases: {},
      }
    );
  }

  private reconcile(
    cache: DockerHubCacheRecord,
    items: DockerHubTag[]
  ): boolean {
    let needNextPage = true;
    let packageLastModified = DateTime.fromISO(cache.lastModified);

    for (const { id, release } of items) {
      const cachedItem = cache.releases[id] as Release | undefined;
      if (cachedItem) {
        needNextPage = false;
      } else {
        this.persistData = true;
      }

      cache.releases[id] = release;

      const tagLastModified = DateTime.fromISO(release.releaseTimestamp);
      if (tagLastModified > packageLastModified) {
        packageLastModified = tagLastModified;
        this.persistData = true;
      }
    }

    const lastModified = packageLastModified.toISO();
    // istanbul ignore else: should never happen
    if (lastModified) {
      cache.lastModified = lastModified;
    } else {
      logger.warn(
        {
          packageName: this.packageName,
          timestamp: packageLastModified,
        },
        `Docker: invalid timestamp leads to excessive API calls`
      );
    }

    return needNextPage;
  }

  private async sync(): Promise<DockerHubCacheRecord> {
    const cache = await this.getCache();
    const url = `https://hub.docker.com/v2/repositories/${this.packageName}/tags?page_size=100`;
    let { nextPage, items } = await this.http
      .getJsonSafe(url, DockerHubTagsPage)
      .unwrapOrThrow();
    let needNextPage = this.reconcile(cache, items);

    while (nextPage && needNextPage) {
      const res = await this.http
        .getJsonSafe(nextPage, DockerHubTagsPage)
        .unwrapOrThrow();
      ({ nextPage, items } = res);
      needNextPage = this.reconcile(cache, items);
    }

    if (this.persistData) {
      const randomDeltaDays = Math.floor(Math.random() * this.randomDeltaDays);
      await packageCache.set(
        DockerHubCache.cacheNs,
        this.packageName,
        cache,
        3 * (30 + randomDeltaDays) * 24 * 60
      );
    }

    return cache;
  }

  async getTags(): Promise<DockerHubRelease[]> {
    const cache = await this.sync();
    return Object.values(cache.releases);
  }
}

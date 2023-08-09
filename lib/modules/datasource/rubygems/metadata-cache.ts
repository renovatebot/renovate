import * as packageCache from '../../../util/cache/package';
import { toSha256 } from '../../../util/hash';
import type { Http } from '../../../util/http';
import { AsyncResult, Result } from '../../../util/result';
import { parseUrl } from '../../../util/url';
import type { ReleaseResult } from '../types';
import { getV1Releases } from './common';

interface CacheRecord {
  hash: string;
  data: ReleaseResult;
}

export class MetadataCache {
  constructor(private readonly http: Http) {}

  async getRelease(
    registryUrl: string,
    packageName: string,
    versions: string[]
  ): Promise<ReleaseResult> {
    const cacheNs = `datasource-rubygems`;
    const cacheKey = `metadata-cache:${registryUrl}:${packageName}`;
    const hash = toSha256(versions.join(''));

    const loadCache = (): AsyncResult<ReleaseResult, NonNullable<unknown>> =>
      Result.wrapNullable(
        packageCache.get<CacheRecord>(cacheNs, cacheKey),
        'cache-not-found' as const
      ).transform((cache) => {
        return hash === cache.hash
          ? Result.ok(cache.data)
          : Result.err('cache-outdated' as const);
      });

    const saveCache = async (data: ReleaseResult): Promise<ReleaseResult> => {
      const registryHostname = parseUrl(registryUrl)?.hostname;
      if (registryHostname === 'rubygems.org') {
        const newCache: CacheRecord = { hash, data };
        const ttlMinutes = 100 * 24 * 60;
        const ttlRandomDelta = Math.floor(Math.random() * 10 * 24 * 60);
        await packageCache.set(
          cacheNs,
          cacheKey,
          newCache,
          ttlMinutes + ttlRandomDelta
        );
      }

      return data;
    };

    return await loadCache()
      .catch(() =>
        getV1Releases(this.http, registryUrl, packageName).transform(saveCache)
      )
      .catch(() =>
        Result.ok({
          releases: versions.map((version) => ({ version })),
        })
      )
      .unwrapOrThrow();
  }
}

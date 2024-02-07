import { logger } from '../../../logger';
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
  isFallback?: true;
}

function hashVersions(versions: string[]): string {
  return toSha256(versions.sort().join(','));
}

function hashReleases(releases: ReleaseResult): string {
  return hashVersions(releases.releases.map((release) => release.version));
}

type CacheNotFoundError = { type: 'cache-not-found' };
type CacheStaleError = {
  type: 'cache-stale';
  cache: CacheRecord;
};
type CacheInvalidError = { type: 'cache-invalid' };
type CacheLoadError = CacheNotFoundError | CacheStaleError;
type CacheError = CacheNotFoundError | CacheStaleError | CacheInvalidError;

export class MetadataCache {
  constructor(private readonly http: Http) {}

  async getRelease(
    registryUrl: string,
    packageName: string,
    versions: string[],
  ): Promise<ReleaseResult> {
    const cacheNs = `datasource-rubygems`;
    const cacheKey = `metadata-cache:${registryUrl}:${packageName}`;
    const versionsHash = hashVersions(versions);

    const loadCache = (): AsyncResult<ReleaseResult, CacheLoadError> =>
      Result.wrapNullable<CacheRecord, CacheLoadError, CacheLoadError>(
        packageCache.get<CacheRecord>(cacheNs, cacheKey),
        { type: 'cache-not-found' },
      ).transform((cache) => {
        return versionsHash === cache.hash
          ? Result.ok(cache.data)
          : Result.err({ type: 'cache-stale', cache });
      });

    const saveCache = async (
      cache: CacheRecord,
      ttlMinutes = 100 * 24 * 60,
      ttlDelta = 10 * 24 * 60,
    ): Promise<void> => {
      const registryHostname = parseUrl(registryUrl)?.hostname;
      if (registryHostname === 'rubygems.org') {
        const ttlRandomDelta = Math.floor(Math.random() * ttlDelta);
        const ttl = ttlMinutes + ttlRandomDelta;
        await packageCache.set(cacheNs, cacheKey, cache, ttl);
      }
    };

    return await loadCache()
      .catch((err) =>
        getV1Releases(this.http, registryUrl, packageName).transform(
          async (
            data: ReleaseResult,
          ): Promise<Result<ReleaseResult, CacheError>> => {
            const dataHash = hashReleases(data);
            if (dataHash === versionsHash) {
              await saveCache({
                hash: dataHash,
                data,
              });
              return Result.ok(data);
            }

            /**
             * Return stale cache for 24 hours,
             * if metadata is inconsistent with versions list.
             */
            if (err.type === 'cache-stale') {
              const staleCache = err.cache;
              if (!staleCache.isFallback) {
                await saveCache(
                  { ...staleCache, isFallback: true },
                  24 * 60,
                  0,
                );
              }
              return Result.ok(staleCache.data);
            }

            return Result.err({ type: 'cache-invalid' });
          },
        ),
      )
      .catch((err) => {
        logger.debug(
          { err },
          'Rubygems: error fetching rubygems data, falling back to versions-only result',
        );
        const releases = versions.map((version) => ({ version }));
        return Result.ok({ releases } as ReleaseResult);
      })
      .unwrapOrThrow();
  }
}

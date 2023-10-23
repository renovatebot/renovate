import { DateTime } from 'luxon';
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
  createdAt: string;
  data: ReleaseResult;
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
type CacheInconsistentError = { type: 'cache-inconsistent' };
type CacheLoadError = CacheNotFoundError | CacheStaleError;
type CacheError = CacheNotFoundError | CacheStaleError | CacheInconsistentError;

export class MetadataCache {
  constructor(private readonly http: Http) {}

  async getRelease(
    registryUrl: string,
    packageName: string,
    versions: string[]
  ): Promise<ReleaseResult> {
    const cacheNs = `datasource-rubygems`;
    const cacheKey = `metadata-cache-v2:${registryUrl}:${packageName}`;
    const versionsHash = hashVersions(versions);

    const loadCache = (): AsyncResult<ReleaseResult, CacheLoadError> =>
      Result.wrapNullable<CacheRecord, CacheLoadError, CacheLoadError>(
        packageCache.get<CacheRecord>(cacheNs, cacheKey),
        { type: 'cache-not-found' }
      ).transform((cache) => {
        return versionsHash === cache.hash
          ? Result.ok(cache.data)
          : Result.err({ type: 'cache-stale', cache });
      });

    const saveCache = async (
      cache: CacheRecord,
      ttlDelta = 10 * 24 * 60
    ): Promise<void> => {
      const registryHostname = parseUrl(registryUrl)?.hostname;
      if (registryHostname === 'rubygems.org') {
        const createdAtDate = DateTime.fromISO(cache.createdAt);
        const now = DateTime.now();
        const ttlElapsedMinutes = Math.max(
          0,
          now.diff(createdAtDate, 'minutes').minutes
        );

        const ttlMinutes = 100 * 24 * 60;
        const ttlRandomDelta = Math.floor(Math.random() * ttlDelta);
        const ttl = ttlMinutes + ttlRandomDelta - ttlElapsedMinutes;
        await packageCache.set(cacheNs, cacheKey, cache, ttl);
      }
    };

    return await loadCache()
      .catch((err) =>
        getV1Releases(this.http, registryUrl, packageName).transform(
          async (
            newData: ReleaseResult
          ): Promise<Result<ReleaseResult, CacheError>> => {
            const v1ReleasesHash = hashReleases(newData);
            if (v1ReleasesHash === versionsHash) {
              const createdAt = DateTime.now().toISO()!;
              await saveCache({
                hash: v1ReleasesHash,
                data: newData,
                createdAt,
              });
              return Result.ok(newData);
            }

            if (err.type === 'cache-stale') {
              const cache = err.cache;
              await saveCache(cache, 0);
              return Result.ok(cache.data);
            }

            return Result.err({ type: 'cache-inconsistent' });
          }
        )
      )
      .catch((err) => {
        logger.debug(
          { err },
          'Rubygems: error fetching rubygems data, falling back to versions-only result'
        );
        const releases = versions.map((version) => ({ version }));
        return Result.ok({ releases } as ReleaseResult);
      })
      .unwrapOrThrow();
  }
}

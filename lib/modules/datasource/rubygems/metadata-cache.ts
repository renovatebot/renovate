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
}

function hashVersions(versions: string[]): string {
  return toSha256(versions.sort().join(','));
}

function hashReleases(releases: ReleaseResult): string {
  return hashVersions(releases.releases.map((release) => release.version));
}

type CacheError = 'cache-not-found' | 'cache-outdated' | 'inconsistent-data';

export class MetadataCache {
  constructor(private readonly http: Http) {}

  async getRelease(
    registryUrl: string,
    packageName: string,
    versions: string[]
  ): Promise<ReleaseResult> {
    const cacheNs = `datasource-rubygems`;
    const cacheKey = `metadata-cache:${registryUrl}:${packageName}`;
    const versionsHash = hashVersions(versions);

    const loadCache = (): AsyncResult<ReleaseResult, CacheError> =>
      Result.wrapNullable<CacheRecord, CacheError, CacheError>(
        packageCache.get<CacheRecord>(cacheNs, cacheKey),
        'cache-not-found'
      ).transform((cache) => {
        return versionsHash === cache.hash
          ? Result.ok(cache.data)
          : Result.err('cache-outdated');
      });

    const saveCache = async (
      hash: string,
      data: ReleaseResult,
      ttlMinutes = 100 * 24 * 60,
      ttlDelta = 10 * 24 * 60
    ): Promise<void> => {
      const registryHostname = parseUrl(registryUrl)?.hostname;
      if (registryHostname === 'rubygems.org') {
        const newCache: CacheRecord = { hash, data };
        const ttlRandomDelta = Math.floor(Math.random() * ttlDelta);
        await packageCache.set(
          cacheNs,
          cacheKey,
          newCache,
          ttlMinutes + ttlRandomDelta
        );
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
              await saveCache(v1ReleasesHash, newData);
              return Result.ok(newData);
            }

            logger.debug(
              { err },
              'Rubygems: error fetching releases timestamp data'
            );
            return Result.err('inconsistent-data');
          }
        )
      )
      .catch(() => {
        const releases = versions.map((version) => ({ version }));
        return Result.ok({ releases } as ReleaseResult);
      })
      .unwrapOrThrow();
  }
}

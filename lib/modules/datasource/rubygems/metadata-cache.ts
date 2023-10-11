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

type CacheError =
  | { type: 'cache-not-found' }
  | {
      type: 'cache-outdated';
      staleData: ReleaseResult;
    }
  | { type: 'inconsistent-data' };

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
        { type: 'cache-not-found' }
      ).transform((cache) => {
        return versionsHash === cache.hash
          ? Result.ok(cache.data)
          : Result.err({ type: 'cache-outdated', staleData: cache.data });
      });

    const saveCache = async (
      hash: string,
      data: ReleaseResult
    ): Promise<void> => {
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

            if (err.type === 'cache-outdated') {
              return Result.ok(err.staleData);
            }

            logger.debug(
              { err },
              'Rubygems: error fetching releases timestamp data'
            );
            return Result.err({ type: 'inconsistent-data' });
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

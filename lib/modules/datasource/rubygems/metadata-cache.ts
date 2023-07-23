import hasha from 'hasha';
import * as packageCache from '../../../util/cache/package';
import type { Http } from '../../../util/http';
import { AsyncResult, Result } from '../../../util/result';
import { parseUrl } from '../../../util/url';
import type { ReleaseResult } from '../types';
import { assignMetadata, getV1Metadata, getV1Releases } from './common';

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
    const hash = hasha(versions, { algorithm: 'sha256' });

    const loadCache = (): AsyncResult<ReleaseResult, unknown> =>
      Result.wrapNullable(
        packageCache.get<CacheRecord>(cacheNs, cacheKey),
        'cache-not-found'
      ).transform((cache) => {
        return hash === cache.hash
          ? Result.ok(cache.data)
          : Result.err('cache-outdated');
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
        getV1Releases(this.http, registryUrl, packageName)
          .transform((releaseResult) =>
            getV1Metadata(this.http, registryUrl, packageName)
              .transform((metadata) => assignMetadata(releaseResult, metadata))
              .unwrap(releaseResult)
          )
          .transform(saveCache)
      )
      .catch(() =>
        Result.ok({
          releases: versions.map((version) => ({ version })),
        })
      )
      .unwrapOrThrow();
  }
}

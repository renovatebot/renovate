import hasha from 'hasha';
import * as packageCache from '../../../util/cache/package';
import type { Http } from '../../../util/http';
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
    const hash = hasha(versions, { algorithm: 'sha256' });
    const cacheNs = `datasource-rubygems`;
    const cacheKey = `metadata-cache:${registryUrl}:${packageName}`;
    const oldCache = await packageCache.get<CacheRecord>(cacheNs, cacheKey);
    if (oldCache?.hash === hash) {
      return oldCache.data;
    }

    return getV1Releases(this.http, registryUrl, packageName)
      .transform(async (result) => {
        const registryHostname = parseUrl(registryUrl)?.hostname;
        if (registryHostname === 'rubygems.org') {
          const newCache: CacheRecord = { hash, data: result };
          const ttlMinutes = 100 * 24 * 60;
          const ttlRandomDelta = Math.floor(Math.random() * 10 * 24 * 60);
          await packageCache.set(
            cacheNs,
            cacheKey,
            newCache,
            ttlMinutes + ttlRandomDelta
          );
        }

        return result;
      })
      .unwrap({
        releases: versions.map((version) => ({ version })),
      });
  }
}

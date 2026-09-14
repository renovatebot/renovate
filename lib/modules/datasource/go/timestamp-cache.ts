import { GlobalConfig } from '../../../config/global.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import { parseUrl, trimTrailingSlash } from '../../../util/url.ts';
import { isPublicGoPackage } from './common.ts';
import { VersionTimestamps } from './schema.ts';

const cacheNamespace = 'datasource-go-proxy-timestamps';

// a module's `go.mod` should /never/ change after it's published. If going via the Go Proxy and the Go Checksum Database, a change in this value will result in build failures.
const ttlMinutes = 100 * 24 * 60;

/**
 * The publication times we already know for a module, so that a run only fetches the `.info` file of a version it has never seen before.
 *
 * This is intentionally separate from the Go module's releases cache, as the current releases list changes (somewhat frequently), whereas the release timestamp for a given Go module shouldn't change after publication.
 */
export class GoVersionTimestampCache {
  private isChanged = false;
  private cacheKey: string | null;
  private timestamps: Record<string, Timestamp>;

  private constructor(
    cacheKey: string | null,
    timestamps: Record<string, Timestamp>,
  ) {
    this.cacheKey = cacheKey;
    this.timestamps = timestamps;
  }

  static async init(
    baseUrl: string,
    packageName: string,
  ): Promise<GoVersionTimestampCache> {
    const cacheKey = getCacheKey(baseUrl, packageName);
    if (!cacheKey) {
      return new GoVersionTimestampCache(null, {});
    }

    return new GoVersionTimestampCache(cacheKey, await read(cacheKey));
  }

  get(version: string): Timestamp | undefined {
    return this.timestamps[version];
  }

  set(version: string, timestamp: Timestamp): void {
    this.timestamps[version] = timestamp;
    this.isChanged = true;
  }

  async save(): Promise<void> {
    if (!this.cacheKey || !this.isChanged) {
      return;
    }

    // `foo` and `foo/v2` are separate lookups which both walk the `v2` module, so another one of them may have written its own timestamps while we were fetching ours
    const current = await read(this.cacheKey);

    await packageCache.set(
      cacheNamespace,
      this.cacheKey,
      { ...current, ...this.timestamps },
      ttlMinutes,
    );
  }
}

async function read(cacheKey: string): Promise<Record<string, Timestamp>> {
  const cached = await packageCache.get<unknown>(cacheNamespace, cacheKey);
  return cached ? VersionTimestamps.parse(cached) : {};
}

/**
 * Timestamps are only shared between modules served by the same proxy, and only stored at all for modules we may cache.
 *
 * Any credentials in the proxy URL are left out, as the key is stored as-is by the cache backends.
 */
function getCacheKey(baseUrl: string, packageName: string): string | null {
  const cachePrivatePackages = GlobalConfig.get('cachePrivatePackages');
  if (!cachePrivatePackages && !isPublicGoPackage(packageName)) {
    return null;
  }

  const parsedUrl = parseUrl(baseUrl);
  if (!parsedUrl) {
    return null;
  }

  const proxy = `${parsedUrl.origin}${trimTrailingSlash(parsedUrl.pathname)}`;
  return `${proxy}@@${packageName}`;
}

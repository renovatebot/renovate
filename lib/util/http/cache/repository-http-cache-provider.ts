import { get as memGet, set as memSet } from '../../cache/memory';
import { getCache } from '../../cache/repository';
import type { HttpResponse } from '../types';
import { copyResponse } from '../util';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import { HttpCache } from './schema';

export class RepositoryHttpCacheProvider extends AbstractHttpCacheProvider {
  constructor(private aggressive = false) {
    super();
  }

  override load(url: string): Promise<unknown> {
    const cache = getCache();
    cache.httpCache ??= {};
    return Promise.resolve(cache.httpCache[url]);
  }

  override persist(url: string, data: HttpCache): Promise<void> {
    const cache = getCache();
    cache.httpCache ??= {};
    cache.httpCache[url] = data;
    return Promise.resolve();
  }

  private getSyncFlags(): Record<string, boolean> {
    let flags = memGet<Record<string, boolean>>('repo-cache-flags');
    if (!flags) {
      flags = {};
      memSet('repo-cache-flags', flags);
    }
    return flags;
  }

  private isSynced(url: string): boolean {
    if (!this.aggressive) {
      return false;
    }

    const flags = this.getSyncFlags();
    return !!flags[url];
  }

  private markSynced(url: string): void {
    const flags = this.getSyncFlags();
    flags[url] = true;
  }

  override wrapServerResponse<T>(
    url: string,
    resp: HttpResponse<T>,
  ): Promise<HttpResponse<T>> {
    const res = super.wrapServerResponse(url, resp);
    this.markSynced(url);
    return res;
  }

  override async bypassServer<T>(
    url: string,
    _ignoreSoftTtl: boolean,
  ): Promise<HttpResponse<T> | null> {
    if (!this.isSynced(url)) {
      return null;
    }

    const cache = await this.load(url);
    const httpCache = HttpCache.parse(cache);
    if (!httpCache) {
      return null;
    }

    return copyResponse(httpCache.httpResponse as HttpResponse<T>, true);
  }
}

export const repoCacheProvider = new RepositoryHttpCacheProvider();

/**
 * This is useful when you use `memCacheProvider`,
 * but want the values be persisted for longer time.
 */
export const aggressiveRepoCacheProvider = new RepositoryHttpCacheProvider(
  true,
);

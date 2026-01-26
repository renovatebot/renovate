import { get as memGet, set as memSet } from '../../cache/memory/index.ts';
import { getCache } from '../../cache/repository/index.ts';
import type { HttpResponse } from '../types.ts';
import { copyResponse } from '../util.ts';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider.ts';
import type { HttpCache } from './schema.ts';

export class RepositoryHttpCacheProvider extends AbstractHttpCacheProvider {
  constructor(private aggressive = false) {
    super();
  }

  override load(method: string, url: string): Promise<unknown> {
    const cache = getCache();

    if (method === 'head') {
      cache.httpCacheHead ??= {};
      return Promise.resolve(cache.httpCacheHead[url]);
    }

    cache.httpCache ??= {};
    return Promise.resolve(cache.httpCache[url]);
  }

  override persist(
    method: string,
    url: string,
    data: HttpCache,
  ): Promise<void> {
    const cache = getCache();

    if (method === 'head') {
      cache.httpCacheHead ??= {};
      cache.httpCacheHead[url] = data;
      return Promise.resolve();
    }

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

  private isSynced(method: string, url: string): boolean {
    if (!this.aggressive) {
      return false;
    }

    const flags = this.getSyncFlags();
    return !!flags[`${method}:${url}`];
  }

  markSynced(method: string, url: string, value = true): void {
    const flags = this.getSyncFlags();
    flags[`${method}:${url}`] = value;
  }

  override wrapServerResponse<T>(
    method: string,
    url: string,
    resp: HttpResponse<T>,
  ): Promise<HttpResponse<T>> {
    const res = super.wrapServerResponse(method, url, resp);
    this.markSynced(method, url);
    return res;
  }

  override async bypassServer<T>(
    method: string,
    url: string,
    _ignoreSoftTtl: boolean,
  ): Promise<HttpResponse<T> | null> {
    if (!this.isSynced(method, url)) {
      return null;
    }

    const httpCache = await this.get(method, url);
    if (!httpCache) {
      return null;
    }

    // Deep copy is needed because the underlying storage for repository cache is the plain object.
    // This object gets persisted at the end of the run.
    // However, during the run, we don't want to accidentally return the same response objects.
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

import { get as memGet, set as memSet } from '../../cache/memory';
import { getCache } from '../../cache/repository';
import type { HttpResponse } from '../types';
import { copyResponse } from '../util';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import { HttpCache } from './schema';

export class RepositoryHttpCacheProvider extends AbstractHttpCacheProvider {
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
    const flags = this.getSyncFlags();
    return !!flags[url];
  }

  private flagSynced(url: string): void {
    const flags = this.getSyncFlags();
    flags[url] = true;
  }

  unflagSynced(url: string): void {
    const flags = this.getSyncFlags();
    for (const fullUrl of Object.keys(flags)) {
      if (fullUrl.includes(url)) {
        delete flags[fullUrl];
      }
    }
  }

  override wrapServerResponse<T>(
    url: string,
    resp: HttpResponse<T>,
  ): Promise<HttpResponse<T>> {
    const res = super.wrapServerResponse(url, resp);
    this.flagSynced(url);
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

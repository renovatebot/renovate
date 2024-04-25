import { getCache } from '../../cache/repository';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import type { HttpCache } from './types';

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
}

export const repoCacheProvider = new RepositoryHttpCacheProvider();

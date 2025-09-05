import { getCache } from '../../cache/repository';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import type { HttpCache } from './schema';

export class RepositoryHttpCacheProvider extends AbstractHttpCacheProvider {
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
}

export const repoCacheProvider = new RepositoryHttpCacheProvider();

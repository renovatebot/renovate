import * as memCache from '../../cache/memory';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import type { HttpCache } from './schema';

export class MemoryHttpCacheProvider extends AbstractHttpCacheProvider {
  private cacheKey(url: string): string {
    return `memory-cache-http-provider:${url}`;
  }

  protected override load(url: string): Promise<unknown> {
    const data = memCache.get<HttpCache>(this.cacheKey(url));
    return Promise.resolve(data);
  }

  protected override persist(url: string, data: HttpCache): Promise<void> {
    memCache.set(this.cacheKey(url), data);
    return Promise.resolve();
  }
}

export const memCacheProvider = new MemoryHttpCacheProvider();

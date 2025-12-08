import * as memCache from '../../cache/memory';
import { clone } from '../../clone';
import type { HttpResponse } from '../types';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import type { HttpCache } from './schema';

export class MemoryHttpCacheProvider extends AbstractHttpCacheProvider {
  private cacheKey(method: string, url: string): string {
    return `memory-cache-http-provider:${method}:${url}`;
  }

  protected override load(method: string, url: string): Promise<unknown> {
    const data = memCache.get<HttpCache>(this.cacheKey(method, url));
    const cloned = clone(data); // Ensures cached responses cannot be mutated
    return Promise.resolve(cloned);
  }

  protected override persist(
    method: string,
    url: string,
    data: HttpCache,
  ): Promise<void> {
    memCache.set(this.cacheKey(method, url), data);
    return Promise.resolve();
  }

  override async bypassServer<T>(
    method: string,
    url: string,
  ): Promise<HttpResponse<T> | null> {
    const cached = await this.get(method, url);
    if (!cached) {
      return null;
    }

    return cached.httpResponse as HttpResponse<T>;
  }
}

export const memCacheProvider = new MemoryHttpCacheProvider();

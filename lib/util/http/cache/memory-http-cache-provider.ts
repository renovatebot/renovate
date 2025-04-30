import * as memCache from '../../cache/memory';
import type { HttpResponse } from '../types';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import type { HttpCache } from './schema';

export class MemoryHttpCacheProvider extends AbstractHttpCacheProvider {
  private cacheKey(url: string): string {
    return `memory-cache-http-provider:${url}`;
  }

  protected override load(url: string): Promise<unknown> {
    const data = memCache.get<string | undefined>(this.cacheKey(url));
    if (typeof data === 'string') {
      const parsed = JSON.parse(data);
      return Promise.resolve(parsed);
    }
    return Promise.resolve(data);
  }

  protected override persist(url: string, data: HttpCache): Promise<void> {
    const stringData = JSON.stringify(data);
    memCache.set(this.cacheKey(url), stringData);
    return Promise.resolve();
  }

  override async bypassServer<T>(url: string): Promise<HttpResponse<T> | null> {
    const cached = await this.get(url);
    if (!cached) {
      return null;
    }

    return cached.httpResponse as HttpResponse<T>;
  }
}

export const memCacheProvider = new MemoryHttpCacheProvider();

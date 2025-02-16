import { DateTime } from 'luxon';
import { get, set } from '../../cache/package'; // Import the package cache functions
import { resolveTtlValues } from '../../cache/package/ttl';
import type { PackageCacheNamespace } from '../../cache/package/types';
import { HttpCacheStats } from '../../stats';
import type { HttpResponse } from '../types';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import type { HttpCache } from './schema';

export interface PackageHttpCacheProviderOptions {
  namespace: PackageCacheNamespace;
  ttlMinutes?: number;
}

export class PackageHttpCacheProvider extends AbstractHttpCacheProvider {
  private namespace: PackageCacheNamespace;

  private softTtlMinutes: number;
  private hardTtlMinutes: number;

  constructor({ namespace, ttlMinutes = 15 }: PackageHttpCacheProviderOptions) {
    super();
    this.namespace = namespace;
    const { softTtlMinutes, hardTtlMinutes } = resolveTtlValues(
      this.namespace,
      ttlMinutes,
    );
    this.softTtlMinutes = softTtlMinutes;
    this.hardTtlMinutes = hardTtlMinutes;
  }

  async load(url: string): Promise<unknown> {
    return await get(this.namespace, url);
  }

  async persist(url: string, data: HttpCache): Promise<void> {
    await set(this.namespace, url, data, this.hardTtlMinutes);
  }

  override async bypassServer<T>(
    url: string,
    ignoreSoftTtl = false,
  ): Promise<HttpResponse<T> | null> {
    const cached = await this.get(url);
    if (!cached) {
      return null;
    }

    if (ignoreSoftTtl) {
      return cached.httpResponse as HttpResponse<T>;
    }

    const cachedAt = DateTime.fromISO(cached.timestamp);
    const deadline = cachedAt.plus({ minutes: this.softTtlMinutes });
    const now = DateTime.now();
    if (now >= deadline) {
      HttpCacheStats.incLocalMisses(url);
      return null;
    }

    HttpCacheStats.incLocalHits(url);
    return cached.httpResponse as HttpResponse<T>;
  }
}

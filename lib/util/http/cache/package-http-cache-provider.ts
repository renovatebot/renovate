import { DateTime } from 'luxon';
import { get, set } from '../../cache/package'; // Import the package cache functions
import type { PackageCacheNamespace } from '../../cache/package/types';
import type { HttpResponse } from '../types';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import type { HttpCache } from './schema';

export interface PackageHttpCacheProviderOptions {
  namespace: PackageCacheNamespace;
  softTtlMinutes?: number;
  hardTtlMinutes?: number;
}

export class PackageHttpCacheProvider extends AbstractHttpCacheProvider {
  private namespace: PackageCacheNamespace;
  private softTtlMinutes = 15;
  private hardTtlMinutes = 24 * 60;

  constructor({
    namespace,
    softTtlMinutes,
    hardTtlMinutes,
  }: PackageHttpCacheProviderOptions) {
    super();
    this.namespace = namespace;
    this.softTtlMinutes = softTtlMinutes ?? this.softTtlMinutes;
    this.hardTtlMinutes = hardTtlMinutes ?? this.hardTtlMinutes;
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
      return null;
    }

    return cached.httpResponse as HttpResponse<T>;
  }
}

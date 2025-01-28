import { get, set } from '../../cache/package'; // Import the package cache functions
import { resolveTtlValues } from '../../cache/package/ttl';
import type { PackageCacheNamespace } from '../../cache/package/types';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import type { HttpCache } from './schema';

export interface PackageHttpCacheProviderOptions {
  namespace: PackageCacheNamespace;
  ttlMinutes?: number;
}

export class PackageHttpCacheProvider extends AbstractHttpCacheProvider {
  private namespace: PackageCacheNamespace;

  protected override softTtlMinutes: number;
  protected override hardTtlMinutes: number;

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
}

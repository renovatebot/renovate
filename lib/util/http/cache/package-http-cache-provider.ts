import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import * as packageCache from '../../cache/package';
import { resolveTtlValues } from '../../cache/package/ttl';
import type { PackageCacheNamespace } from '../../cache/package/types';
import { regEx } from '../../regex';
import { HttpCacheStats } from '../../stats';
import type { HttpResponse } from '../types';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import type { HttpCache } from './schema';

export interface PackageHttpCacheProviderOptions {
  namespace: PackageCacheNamespace;
  softTtlMinutes?: number;
  checkCacheControlHeader: boolean;
  checkAuthorizationHeader: boolean;
}

export class PackageHttpCacheProvider extends AbstractHttpCacheProvider {
  private namespace: PackageCacheNamespace;

  private softTtlMinutes: number;
  private hardTtlMinutes: number;

  checkCacheControlHeader: boolean;
  checkAuthorizationHeader: boolean;

  constructor({
    namespace,
    softTtlMinutes = 15,
    checkCacheControlHeader = false,
    checkAuthorizationHeader = false,
  }: PackageHttpCacheProviderOptions) {
    super();
    this.namespace = namespace;
    const ttlValues = resolveTtlValues(this.namespace, softTtlMinutes);
    this.softTtlMinutes = ttlValues.softTtlMinutes;
    this.hardTtlMinutes = ttlValues.hardTtlMinutes;
    this.checkCacheControlHeader = checkCacheControlHeader;
    this.checkAuthorizationHeader = checkAuthorizationHeader;
  }

  private cacheKey(method: string, url: string): string {
    if (method !== 'get') {
      return `${method}:${url}`;
    }
    return url;
  }

  async load(method: string, url: string): Promise<unknown> {
    return await packageCache.get(this.namespace, this.cacheKey(method, url));
  }

  async persist(method: string, url: string, data: HttpCache): Promise<void> {
    await packageCache.setWithRawTtl(
      this.namespace,
      this.cacheKey(method, url),
      data,
      this.hardTtlMinutes,
    );
  }

  override async bypassServer<T>(
    method: string,
    url: string,
    ignoreSoftTtl = false,
  ): Promise<HttpResponse<T> | null> {
    const cached = await this.get(method, url);
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

  cacheAllowed<T>(resp: HttpResponse<T>): boolean {
    const allowedViaGlobalConfig = GlobalConfig.get(
      'cachePrivatePackages',
      false,
    );
    if (allowedViaGlobalConfig) {
      return true;
    }

    if (
      this.checkCacheControlHeader &&
      is.string(resp.headers['cache-control'])
    ) {
      const isPublic = resp.headers['cache-control']
        .toLocaleLowerCase()
        .split(regEx(/\s*,\s*/))
        .includes('public');

      if (!isPublic) {
        return false;
      }
    }

    if (this.checkAuthorizationHeader && resp.authorization) {
      return false;
    }

    return true;
  }

  override async wrapServerResponse<T>(
    method: string,
    url: string,
    resp: HttpResponse<T>,
  ): Promise<HttpResponse<T>> {
    if (resp.statusCode === 200 && !this.cacheAllowed(resp)) {
      return resp;
    }

    return await super.wrapServerResponse(method, url, resp);
  }
}

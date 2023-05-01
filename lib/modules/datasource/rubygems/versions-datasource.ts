import hasha from 'hasha';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { PAGE_NOT_FOUND_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { HttpError } from '../../../util/http';
import type { HttpOptions } from '../../../util/http/types';
import { newlineRegex } from '../../../util/regex';
import { LooseArray } from '../../../util/schema-utils';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

type PackageReleases = Map<string, string[]>;

interface RegistryCache {
  cacheSyncedAt: number;
  contentRangeOffset: number;
  fingerprint: string;
  isSupported: boolean;
  packageReleases: PackageReleases;
}

export const memCache = new Map<string, RegistryCache>();

const VersionLines = z
  .string()
  .transform((x) => x.split(newlineRegex))
  .pipe(
    LooseArray(
      z
        .string()
        .transform((line) => line.trim())
        .refine((line) => line.length > 0)
        .refine((line) => !line.startsWith('created_at:'))
        .refine((line) => line !== '---')
        .transform((line) => line.split(' '))
        .pipe(z.tuple([z.string(), z.string()]).rest(z.string()))
        .transform(([packageName, versions]) => {
          const deletedVersions = new Set<string>();
          const addedVersions: string[] = [];
          for (const version of versions.split(',')) {
            if (version.startsWith('-')) {
              deletedVersions.add(version.slice(1));
            } else {
              addedVersions.push(version);
            }
          }
          return { packageName, deletedVersions, addedVersions };
        }),
      {
        onError: ({ error: err, input }) => {
          logger.debug(
            { err, input },
            'Rubygems: failed to parse some version lines'
          );
        },
      }
    )
  );
type Lines = z.infer<typeof VersionLines>;

export class VersionsDatasource extends Datasource {
  private static newCache(cache?: RegistryCache): RegistryCache {
    return {
      cacheSyncedAt: 0,
      contentRangeOffset: 0,
      fingerprint: '',
      isSupported: false,
      packageReleases: new Map<string, string[]>(),
    };
  }

  private static resetCache(cache: RegistryCache): void {
    cache.cacheSyncedAt = 0;
    cache.contentRangeOffset = 0;
    cache.fingerprint = '';
    cache.isSupported = false;
    cache.packageReleases.clear();
  }

  /**
   * Since each `/versions` reponse exceed 10MB,
   * there is potential for a memory leak if we construct slices
   * of the response body and cache them long-term:
   *
   *   https://bugs.chromium.org/p/v8/issues/detail?id=2869
   *
   * This method meant to be called for `version` and `packageName`
   * before storing them in the cache.
   */
  private static copystr(x: string): string {
    const len = Buffer.byteLength(x, 'utf8');
    const buf = Buffer.allocUnsafeSlow(len);
    buf.write(x, 'utf8');
    return buf.toString('utf8');
  }

  private static getCache(registryUrl: string): RegistryCache {
    const cacheKey = `rubygems-versions-cache:${registryUrl}`;
    const oldCache = memCache.get(cacheKey);
    if (oldCache) {
      return oldCache;
    }

    const newCache: RegistryCache = VersionsDatasource.newCache();
    memCache.set(cacheKey, newCache);
    return newCache;
  }

  constructor(override readonly id: string) {
    super(id);
  }

  private updatePackageReleases(
    packageReleases: PackageReleases,
    lines: Lines
  ): void {
    for (const line of lines) {
      const packageName = VersionsDatasource.copystr(line.packageName);
      let versions = packageReleases.get(packageName) ?? [];

      const { deletedVersions, addedVersions } = line;

      if (deletedVersions.size > 0) {
        versions = versions.filter((v) => !deletedVersions.has(v));
      }

      if (addedVersions.length > 0) {
        const existingVersions = new Set(versions);
        for (const addedVersion of addedVersions) {
          if (!existingVersions.has(addedVersion)) {
            const version = VersionsDatasource.copystr(addedVersion);
            versions.push(version);
          }
        }
      }

      packageReleases.set(packageName, versions);
    }
  }

  /**
   * Header contains `created_at` field which is enough to determine
   * if the cache is outdated.
   *
   * But instead of parsing date, we hash the first 1024 bytes
   * of the response for the sake of simplicity.
   */
  private async getFingerprint(registryUrl: string): Promise<string> {
    const url = `${registryUrl}/versions`;
    const options: HttpOptions = {
      useCache: false,
      headers: {
        ['Accept-Encoding']: 'deflate, compress, br',
        ['Range']: 'bytes=0-1023',
      },
    };
    const { body } = await this.http.get(url, options);
    const hash = hasha(body, { algorithm: 'sha256' });
    return hash;
  }

  private async fetchVersions(
    registryUrl: string,
    offset: number
  ): Promise<string> {
    const url = `${registryUrl}/versions`;
    const options: HttpOptions =
      offset === 0
        ? { headers: { ['Accept-Encoding']: 'gzip' } }
        : {
            headers: {
              ['Accept-Encoding']: 'deflate, compress, br',
              ['Range']: `bytes=${offset}-`,
            },
          };
    options.useCache = false;

    logger.debug('Rubygems: Fetching rubygems.org versions');
    const start = Date.now();
    const { body } = await this.http.get(url, options);
    const duration = Math.round(Date.now() - start);
    logger.debug(`Rubygems: Fetched rubygems.org versions in ${duration}ms`);

    return body;
  }

  async performSync(
    registryUrl: string,
    regCache: RegistryCache
  ): Promise<void> {
    const now = DateTime.now().toMillis();
    try {
      const fingerprint = await this.getFingerprint(registryUrl);
      if (fingerprint !== regCache.fingerprint) {
        VersionsDatasource.resetCache(regCache);
      }

      const body = await this.fetchVersions(
        registryUrl,
        regCache.contentRangeOffset
      );
      const lines = VersionLines.parse(body);

      regCache.cacheSyncedAt = now;
      regCache.contentRangeOffset += Buffer.byteLength(body, 'utf8');
      regCache.fingerprint = fingerprint;
      regCache.isSupported = true;
      this.updatePackageReleases(regCache.packageReleases, lines);
    } catch (err) /* istanbul ignore next */ {
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        regCache.isSupported = false;
        return;
      }

      if (err.statusCode === 416) {
        logger.debug('Rubygems: No update');
        regCache.cacheSyncedAt = now;
        return;
      }

      VersionsDatasource.resetCache(regCache);

      logger.debug({ err }, 'Rubygems fetch error');
      throw new ExternalHostError(err);
    } finally {
      delete this.pendingSyncs[registryUrl];
    }
  }

  private pendingSyncs: Record<string, Promise<void> | null> = {};

  async syncCache(registryUrl: string, regCache: RegistryCache): Promise<void> {
    const cachedAt = DateTime.fromMillis(regCache.cacheSyncedAt);
    const now = DateTime.now();
    const isStale = cachedAt.plus({ minutes: 15 }) < now;
    if (isStale) {
      this.pendingSyncs[registryUrl] ??= this.performSync(
        registryUrl,
        regCache
      );
      await this.pendingSyncs[registryUrl];
    }
  }

  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.debug(`getRubygemsOrgDependency(${packageName})`);

    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const regCache = VersionsDatasource.getCache(registryUrl);
    await this.syncCache(registryUrl, regCache);

    if (!regCache.isSupported) {
      throw new Error(PAGE_NOT_FOUND_ERROR);
    }

    const versions = regCache.packageReleases.get(packageName);
    if (!versions) {
      return null;
    }

    const releases = versions.map((version) => ({ version }));
    return { releases };
  }
}

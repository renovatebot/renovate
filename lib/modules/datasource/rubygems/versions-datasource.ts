import { z } from 'zod';
import { PAGE_NOT_FOUND_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { getElapsedMinutes } from '../../../util/date';
import { HttpError } from '../../../util/http';
import type { HttpOptions } from '../../../util/http/types';
import { newlineRegex } from '../../../util/regex';
import { LooseArray } from '../../../util/schema-utils';
import { copystr } from '../../../util/string';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

interface VersionsEndpointUnsupported {
  versionsEndpointSupported: false;
}

type PackageVersions = Map<string, string[]>;

interface VersionsEndpointData {
  versionsEndpointSupported: true;
  packageVersions: PackageVersions;
  syncedAt: Date;
  contentLength: number;

  /**
   * Last 33 characters of the response (32 hex digits + newline)
   */
  contentTail: string;
}

function getContentTail(content: string): string {
  return content.slice(-33);
}

function getContentHead(content: string): string {
  return content.slice(0, 33);
}

function stripContentHead(content: string): string {
  return content.slice(33);
}

function parseFullBody(body: string): VersionsEndpointData {
  const versionsEndpointSupported = true;
  const packageVersions = VersionsDatasource.reconcilePackageVersions(
    new Map<string, string[]>(),
    VersionLines.parse(body)
  );
  const syncedAt = new Date();
  const contentLength = body.length;
  const contentTail = getContentTail(body);

  return {
    versionsEndpointSupported,
    packageVersions,
    syncedAt,
    contentLength,
    contentTail,
  };
}

type VersionsEndpointCache = VersionsEndpointUnsupported | VersionsEndpointData;

export const memCache = new Map<string, VersionsEndpointCache>();

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
        })
    )
  );
type VersionLines = z.infer<typeof VersionLines>;

export class VersionsDatasource extends Datasource {
  constructor(override readonly id: string) {
    super(id);
  }

  static isStale(regCache: VersionsEndpointData): boolean {
    return getElapsedMinutes(regCache.syncedAt) >= 15;
  }

  static reconcilePackageVersions(
    packageVersions: PackageVersions,
    versionLines: VersionLines
  ): PackageVersions {
    for (const line of versionLines) {
      const packageName = copystr(line.packageName);
      let versions = packageVersions.get(packageName) ?? [];

      const { deletedVersions, addedVersions } = line;

      if (deletedVersions.size > 0) {
        versions = versions.filter((v) => !deletedVersions.has(v));
      }

      if (addedVersions.length > 0) {
        const existingVersions = new Set(versions);
        for (const addedVersion of addedVersions) {
          if (!existingVersions.has(addedVersion)) {
            const version = copystr(addedVersion);
            versions.push(version);
          }
        }
      }

      packageVersions.set(packageName, versions);
    }

    return packageVersions;
  }

  private cacheRequests = new Map<string, Promise<VersionsEndpointCache>>();

  /**
   * At any given time, there should only be one request for a given registryUrl.
   */
  private async getCache(registryUrl: string): Promise<VersionsEndpointCache> {
    const cacheKey = `rubygems-versions-cache:${registryUrl}`;

    const oldCache = memCache.get(cacheKey);
    memCache.delete(cacheKey); // If no error is thrown, we'll re-set the cache

    let newCache: VersionsEndpointCache;

    if (!oldCache) {
      newCache = await this.fullSync(registryUrl);
    } else if (oldCache.versionsEndpointSupported === false) {
      newCache = oldCache;
    } else if (VersionsDatasource.isStale(oldCache)) {
      newCache = await this.deltaSync(oldCache, registryUrl);
    } else {
      newCache = oldCache;
    }
    memCache.set(cacheKey, newCache);
    return newCache;
  }

  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    /**
     * Ensure that only one request for a given registryUrl is in flight at a time.
     */
    let cacheRequest = this.cacheRequests.get(registryUrl);
    if (!cacheRequest) {
      cacheRequest = this.getCache(registryUrl);
      this.cacheRequests.set(registryUrl, cacheRequest);
    }
    let cache: VersionsEndpointCache;
    try {
      cache = await cacheRequest;
    } finally {
      this.cacheRequests.delete(registryUrl);
    }

    if (cache.versionsEndpointSupported === false) {
      logger.debug(
        { packageName, registryUrl },
        'Rubygems: endpoint not supported'
      );
      throw new Error(PAGE_NOT_FOUND_ERROR);
    }

    const packageVersions = cache.packageVersions.get(packageName);
    if (!packageVersions?.length) {
      logger.debug(
        { packageName, registryUrl },
        'Rubygems: versions not found'
      );
      return null;
    }

    const releases = packageVersions.map((version) => ({ version }));
    return { releases };
  }

  async fullSync(registryUrl: string): Promise<VersionsEndpointCache> {
    try {
      const url = `${registryUrl}/versions`;
      const opts: HttpOptions = { headers: { 'Accept-Encoding': 'gzip' } };
      const { body } = await this.http.get(url, opts);
      return parseFullBody(body);
    } catch (err) {
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        return { versionsEndpointSupported: false };
      }

      throw err instanceof ExternalHostError ? err : new ExternalHostError(err);
    }
  }

  async deltaSync(
    oldCache: VersionsEndpointData,
    registryUrl: string
  ): Promise<VersionsEndpointCache> {
    try {
      const url = `${registryUrl}/versions`;
      const startByte = oldCache.contentLength - oldCache.contentTail.length;
      const opts: HttpOptions = {
        headers: {
          ['Accept-Encoding']: 'deflate, compress, br',
          ['Range']: `bytes=${startByte}-`,
        },
      };
      const { statusCode, body } = await this.http.get(url, opts);

      /**
       * Rubygems will return the full body instead of `416 Range Not Satisfiable`.
       * In this case, status code will be 200 instead of 206.
       */
      if (statusCode === 200) {
        return parseFullBody(body);
      }

      /**
       * Most likely the content has changed since the last sync.
       * This means we need to start over with a full sync.
       */
      const contentHead = getContentHead(body);
      if (contentHead !== oldCache.contentTail) {
        return this.fullSync(registryUrl);
      }

      const versionsEndpointSupported = true;
      const delta = stripContentHead(body);
      const packageVersions = VersionsDatasource.reconcilePackageVersions(
        oldCache.packageVersions,
        VersionLines.parse(delta)
      );
      const syncedAt = new Date();
      const contentLength = oldCache.contentLength + delta.length;
      const contentTail = getContentTail(body);

      return {
        versionsEndpointSupported,
        packageVersions,
        syncedAt,
        contentLength,
        contentTail,
      };
    } catch (err) {
      if (err instanceof HttpError) {
        const responseStatus = err.response?.statusCode;

        /**
         * In case of `416 Range Not Satisfiable` we need to do a full sync.
         * This is unlikely to happen in real life.
         */
        if (responseStatus === 416) {
          return this.fullSync(registryUrl);
        }

        if (responseStatus === 404) {
          return { versionsEndpointSupported: false };
        }
      }

      throw err instanceof ExternalHostError ? err : new ExternalHostError(err);
    }
  }
}

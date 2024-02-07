import { z } from 'zod';
import { logger } from '../../../logger';
import { getElapsedMinutes } from '../../../util/date';
import { Http, HttpError } from '../../../util/http';
import type { HttpOptions } from '../../../util/http/types';
import { newlineRegex } from '../../../util/regex';
import { Result } from '../../../util/result';
import { LooseArray } from '../../../util/schema-utils';
import { copystr } from '../../../util/string';
import { parseUrl } from '../../../util/url';

type PackageVersions = Map<string, string[]>;

interface VersionsEndpointData {
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

function reconcilePackageVersions(
  packageVersions: PackageVersions,
  versionLines: VersionLines,
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

function parseFullBody(body: string): VersionsEndpointResult {
  const packageVersions = reconcilePackageVersions(
    new Map<string, string[]>(),
    VersionLines.parse(body),
  );
  const syncedAt = new Date();
  const contentLength = body.length;
  const contentTail = getContentTail(body);

  return Result.ok({
    packageVersions,
    syncedAt,
    contentLength,
    contentTail,
  });
}

type VersionsEndpointResult = Result<VersionsEndpointData, 'unsupported-api'>;

export const memCache = new Map<string, VersionsEndpointResult>();

function cacheResult(
  registryUrl: string,
  result: VersionsEndpointResult,
): void {
  const registryHostname = parseUrl(registryUrl)?.hostname;
  if (registryHostname === 'rubygems.org') {
    memCache.set(registryUrl, result);
  }
}

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
    ),
  );
type VersionLines = z.infer<typeof VersionLines>;

function isStale(regCache: VersionsEndpointData): boolean {
  return getElapsedMinutes(regCache.syncedAt) >= 15;
}

export type VersionsResult = Result<
  string[],
  'unsupported-api' | 'package-not-found'
>;

export class VersionsEndpointCache {
  constructor(private readonly http: Http) {}

  private cacheRequests = new Map<string, Promise<VersionsEndpointResult>>();

  /**
   * At any given time, there should only be one request for a given registryUrl.
   */
  private async getCache(registryUrl: string): Promise<VersionsEndpointResult> {
    const oldResult = memCache.get(registryUrl);
    if (!oldResult) {
      const newResult = await this.fullSync(registryUrl);
      cacheResult(registryUrl, newResult);
      return newResult;
    }

    const { val: data } = oldResult.unwrap();
    if (!data) {
      return oldResult;
    }

    if (isStale(data)) {
      memCache.delete(registryUrl); // If no error is thrown, we'll re-set the cache
      const newResult = await this.deltaSync(data, registryUrl);
      cacheResult(registryUrl, newResult);
      return newResult;
    }

    return oldResult;
  }

  async getVersions(
    registryUrl: string,
    packageName: string,
  ): Promise<VersionsResult> {
    /**
     * Ensure that only one request for a given registryUrl is in flight at a time.
     */
    let cacheRequest = this.cacheRequests.get(registryUrl);
    if (!cacheRequest) {
      cacheRequest = this.getCache(registryUrl);
      this.cacheRequests.set(registryUrl, cacheRequest);
    }
    let cachedResult: VersionsEndpointResult;
    try {
      cachedResult = await cacheRequest;
    } finally {
      this.cacheRequests.delete(registryUrl);
    }

    const { val: cachedData } = cachedResult.unwrap();
    if (!cachedData) {
      logger.debug(
        { packageName, registryUrl },
        'Rubygems: endpoint not supported',
      );
      return Result.err('unsupported-api');
    }

    const versions = cachedData.packageVersions.get(packageName);
    if (!versions?.length) {
      logger.debug(
        { packageName, registryUrl },
        'Rubygems: versions not found',
      );
      return Result.err('package-not-found');
    }

    return Result.ok(versions);
  }

  private async fullSync(registryUrl: string): Promise<VersionsEndpointResult> {
    try {
      const url = `${registryUrl}/versions`;
      const opts: HttpOptions = { headers: { 'Accept-Encoding': 'gzip' } };
      const { body } = await this.http.get(url, opts);
      return parseFullBody(body);
    } catch (err) {
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        return Result.err('unsupported-api');
      }

      throw err;
    }
  }

  private async deltaSync(
    oldCache: VersionsEndpointData,
    registryUrl: string,
  ): Promise<VersionsEndpointResult> {
    try {
      const url = `${registryUrl}/versions`;
      const startByte = oldCache.contentLength - oldCache.contentTail.length;
      const opts: HttpOptions = {
        headers: {
          ['Accept-Encoding']: 'deflate, compress, br', // Note: `gzip` usage breaks http client, when used with `Range` header
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
       * We request data in range that overlaps previously fetched data.
       * If the head of the response doesn't match the tail of the previous response,
       * it means that the data we have is no longer valid.
       * In this case we start over with a full sync.
       */
      const contentHead = getContentHead(body);
      if (contentHead !== oldCache.contentTail) {
        return this.fullSync(registryUrl);
      }

      /**
       * Update the cache with the new data.
       */
      const delta = stripContentHead(body);
      const packageVersions = reconcilePackageVersions(
        oldCache.packageVersions,
        VersionLines.parse(delta),
      );
      const syncedAt = new Date();
      const contentLength = oldCache.contentLength + delta.length;
      const contentTail = getContentTail(body);

      return Result.ok({
        packageVersions,
        syncedAt,
        contentLength,
        contentTail,
      });
    } catch (err) {
      if (err instanceof HttpError) {
        const responseStatus = err.response?.statusCode;

        /**
         * In case of `416 Range Not Satisfiable` we do a full sync.
         * This is unlikely to happen in real life, but anyway.
         */
        if (responseStatus === 416) {
          return this.fullSync(registryUrl);
        }

        /**
         * If the endpoint is not supported, we stop trying.
         * This is unlikely to happen in real life, but still.
         */
        if (responseStatus === 404) {
          return Result.err('unsupported-api');
        }
      }

      throw err;
    }
  }
}

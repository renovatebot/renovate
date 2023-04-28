import { z } from 'zod';
import { PAGE_NOT_FOUND_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as memCache from '../../../util/cache/memory';
import { getElapsedMinutes } from '../../../util/date';
import { HttpError } from '../../../util/http';
import { newlineRegex } from '../../../util/regex';
import { LooseArray } from '../../../util/schema-utils';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

type PackageReleases = Record<string, string[]>;

interface RegistryCache {
  lastSync: Date;
  packageReleases: PackageReleases;
  contentLength: number;
  isSupported: boolean;
  registryUrl: string;
}

const Lines = z
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
type Lines = z.infer<typeof Lines>;

export class VersionsDatasource extends Datasource {
  private isInitialFetch = true;

  constructor(override readonly id: string) {
    super(id);
  }

  getRegistryCache(registryUrl: string): RegistryCache {
    const cacheKey = `rubygems-versions-cache:${registryUrl}`;
    const regCache = memCache.get<RegistryCache>(cacheKey) ?? {
      lastSync: new Date('2000-01-01'),
      packageReleases: {},
      contentLength: 0,
      isSupported: false,
      registryUrl,
    };
    memCache.set(cacheKey, regCache);
    return regCache;
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
    const regCache = this.getRegistryCache(registryUrl);

    await this.syncVersions(regCache);

    if (!regCache.isSupported) {
      throw new Error(PAGE_NOT_FOUND_ERROR);
    }

    if (!regCache.packageReleases[packageName]) {
      return null;
    }

    const versions = regCache.packageReleases[packageName];
    const releases = versions.map((version) => ({ version }));
    return { releases };
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
  private copystr(x: string): string {
    const len = Buffer.byteLength(x, 'utf8');
    const buf = this.isInitialFetch
      ? Buffer.allocUnsafe(len) // allocate from pre-allocated buffer
      : Buffer.allocUnsafeSlow(len); // allocate standalone buffer
    buf.write(x, 'utf8');
    return buf.toString('utf8');
  }

  private updatePackageReleases(
    packageReleases: PackageReleases,
    lines: Lines
  ): void {
    for (const line of lines) {
      const packageName = this.copystr(line.packageName);
      let versions = packageReleases[packageName] ?? [];

      const { deletedVersions, addedVersions } = line;

      if (deletedVersions.size > 0) {
        versions = versions.filter((v) => !deletedVersions.has(v));
      }

      if (addedVersions.length > 0) {
        const existingVersions = new Set(versions);
        for (const addedVersion of addedVersions) {
          if (!existingVersions.has(addedVersion)) {
            const version = this.copystr(addedVersion);
            versions.push(version);
          }
        }
      }

      packageReleases[packageName] = versions;
    }
  }

  async updateRubyGemsVersions(regCache: RegistryCache): Promise<void> {
    const url = `${regCache.registryUrl}/versions`;
    const options = {
      headers: {
        'accept-encoding': 'identity',
        range: `bytes=${regCache.contentLength}-`,
      },
    };
    let newLines: string;
    try {
      logger.debug('Rubygems: Fetching rubygems.org versions');
      const startTime = Date.now();
      newLines = (await this.http.get(url, options)).body;
      const durationMs = Math.round(Date.now() - startTime);
      logger.debug(`Rubygems: Fetched rubygems.org versions in ${durationMs}`);
    } catch (err) /* istanbul ignore next */ {
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        regCache.isSupported = false;
        return;
      }

      if (err.statusCode === 416) {
        logger.debug('Rubygems: No update');
        regCache.lastSync = new Date();
        return;
      }

      regCache.contentLength = 0;
      regCache.packageReleases = {};

      logger.debug({ err }, 'Rubygems fetch error');
      throw new ExternalHostError(err);
    }

    regCache.isSupported = true;
    regCache.lastSync = new Date();

    const lines = Lines.parse(newLines);
    this.updatePackageReleases(regCache.packageReleases, lines);
    this.isInitialFetch = false;
  }

  private updateRubyGemsVersionsPromise: Promise<void> | null = null;

  async syncVersions(regCache: RegistryCache): Promise<void> {
    const isStale = getElapsedMinutes(regCache.lastSync) >= 15;
    if (isStale) {
      this.updateRubyGemsVersionsPromise =
        this.updateRubyGemsVersionsPromise ??
        this.updateRubyGemsVersions(regCache);
      await this.updateRubyGemsVersionsPromise;
      this.updateRubyGemsVersionsPromise = null;
    }
  }
}

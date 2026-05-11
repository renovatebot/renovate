import { randomUUID } from 'node:crypto';
import { extract as tarExtract } from 'tar';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import * as fs from '../../../util/fs/index.ts';
import { HttpError } from '../../../util/http/index.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { id as looseVersioning } from '../../versioning/loose/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { parseApkIndexFile } from './parser.ts';
import type { ApkPackage } from './types.ts';

export const apkDatasourceId = 'apk';

const defaultConfig = {
  commitMessageTopic: '{{{depName}}} Alpine package',
  commitMessageExtra:
    'to {{#if isMajor}}{{{prettyNewMajor}}}{{else}}{{{prettyNewVersion}}}{{/if}}',
};

export class ApkDatasource extends Datasource {
  static readonly id = apkDatasourceId;

  override readonly defaultVersioning = looseVersioning;

  // Alpine APK repository URL structure:
  // https://dl-cdn.alpinelinux.org/alpine/{version}/{repository}/{architecture}/
  // - version: latest-stable, v3.19, etc.
  // - repository: main, community, testing
  // - architecture: x86_64, aarch64, armv7, etc.
  override readonly defaultRegistryUrls = [
    'https://dl-cdn.alpinelinux.org/alpine/latest-stable/main/x86_64',
  ];

  override readonly defaultConfig = defaultConfig;

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'merge';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `buildDate` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `url` field in the results.';

  constructor() {
    super(ApkDatasource.id);
  }

  /**
   * Gets all available packages from an APK repository
   */
  private async getPackagesUncached(
    registryUrl: string,
  ): Promise<ApkPackage[]> {
    logger.debug(`Fetching APK packages from ${registryUrl}`);

    const indexUrl = joinUrlParts(registryUrl, 'APKINDEX.tar.gz');
    const extractId = randomUUID();
    const cacheDir = await fs.ensureCacheDir(upath.join('apk', extractId));
    const tarFile = upath.join(cacheDir, 'APKINDEX.tar.gz');
    const extractedFile = upath.join(cacheDir, 'APKINDEX');

    try {
      logger.debug({ indexUrl }, 'Attempting to download APKINDEX.tar.gz');
      const readStream = this.http.stream(indexUrl);
      const writeStream = fs.createCacheWriteStream(tarFile);
      await fs.pipeline(readStream, writeStream);

      await tarExtract({
        file: tarFile,
        cwd: cacheDir,
        filter: (path) => path === 'APKINDEX',
      });

      if (!(await fs.cachePathExists(extractedFile))) {
        logger.warn('APKINDEX file not found in tar archive');
        return [];
      }

      logger.debug('Successfully extracted APKINDEX content');

      let packages: ApkPackage[] = [];
      try {
        packages = await parseApkIndexFile(extractedFile);
      } catch (err) {
        logger.warn({ err }, 'Error parsing APK index file');
        return [];
      }

      logger.debug(
        { registryUrl, packageCount: packages.length },
        'Successfully parsed APK index',
      );

      return packages;
    } catch (err) {
      if (err instanceof HttpError) {
        const statusCode = err.response?.statusCode;
        if (statusCode === 429 || (statusCode && statusCode >= 500)) {
          throw new ExternalHostError(err);
        }
        logger.warn({ registryUrl, err }, 'Failed to fetch APK packages');
        throw err;
      }

      /* v8 ignore next 2 -- hard to test tar parser errors */
      logger.warn({ err }, 'Error extracting APK index from tar.gz');
      return [];
    } finally {
      await fs.rmCache(cacheDir);
    }
  }

  private getPackages(registryUrl: string): Promise<ApkPackage[]> {
    return withCache(
      {
        namespace: `datasource-${ApkDatasource.id}`,
        key: registryUrl,
        ttlMinutes: 60,
        fallback: true,
      },
      () => this.getPackagesUncached(registryUrl),
    );
  }

  /**
   * Gets releases for a specific package from APK repositories
   */
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }

    logger.debug(`Getting APK releases for ${packageName} from ${registryUrl}`);

    try {
      const packages = await this.getPackages(registryUrl);

      // Find packages matching the requested package name
      const matchingPackages = packages.filter(
        (pkg) => pkg.name === packageName,
      );

      if (!matchingPackages.length) {
        logger.debug(
          { packageName, registryUrl },
          'No matching packages found',
        );
        return null;
      }

      // Convert packages to releases
      const releases = matchingPackages.map((pkg) => ({
        version: pkg.version,
        releaseTimestamp: pkg.buildDate
          ? asTimestamp(new Date(pkg.buildDate * 1000))
          : undefined,
      }));

      logger.trace(
        { packageName, registryUrl, releaseCount: releases.length, releases },
        'Found APK releases',
      );

      return {
        homepage: matchingPackages[0].url,
        releases,
        registryUrl,
      };
    } catch (err) {
      if (err instanceof ExternalHostError) {
        throw err;
      }
      logger.warn(
        { packageName, registryUrl, err },
        'Error getting APK releases',
      );
      return null;
    }
  }
}

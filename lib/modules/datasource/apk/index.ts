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
import { parseApkIndex } from './parser.ts';
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
   * Fetches the APK index file from the repository
   * @param {string} registryUrl - The URL of the APK repository
   * @returns {string} The uncompressed APKINDEX content of the APK index file
   */
  private async getApkIndex(registryUrl: string): Promise<string> {
    const indexUrl = joinUrlParts(registryUrl, 'APKINDEX.tar.gz');

    try {
      logger.debug({ indexUrl }, 'Attempting to download APKINDEX.tar.gz');
      const response = await this.http.getBuffer(indexUrl);
      return await this.extractApkIndexFromTarGz(response.body);
    } catch (err) {
      if (err instanceof HttpError) {
        const statusCode = err.response?.statusCode;
        if (statusCode === 429 || (statusCode && statusCode >= 500)) {
          throw new ExternalHostError(err);
        }
      }
      throw err;
    }
  }

  /**
   * Extracts the APK index content from a tar.gz buffer
   */
  private async extractApkIndexFromTarGz(buffer: Buffer): Promise<string> {
    const extractId = randomUUID();
    const cacheDir = await fs.ensureCacheDir(upath.join('apk', extractId));
    const tarFile = upath.join(cacheDir, 'APKINDEX.tar.gz');
    const extractedFile = upath.join(cacheDir, 'APKINDEX');

    try {
      await fs.outputCacheFile(tarFile, buffer);

      await tarExtract({
        file: tarFile,
        cwd: cacheDir,
        filter: (path) => path === 'APKINDEX',
      });

      if (await fs.cachePathExists(extractedFile)) {
        logger.debug('Successfully extracted APKINDEX content');
        return await fs.readCacheFile(extractedFile, 'utf8');
      }

      logger.warn('APKINDEX file not found in tar archive');
      return '';
    } catch (err) /* v8 ignore next 3 -- hard to test tar parser errors */ {
      logger.warn({ err }, 'Error extracting APK index from tar.gz');
      return '';
    } finally {
      await fs.rmCache(cacheDir);
    }
  }

  /**
   * Gets all available packages from an APK repository
   */
  private async _getPackages(registryUrl: string): Promise<ApkPackage[]> {
    logger.debug(`Fetching APK packages from ${registryUrl}`);

    try {
      const indexContent = await this.getApkIndex(registryUrl);
      const packages = parseApkIndex(indexContent);

      logger.debug(
        { registryUrl, packageCount: packages.length },
        'Successfully parsed APK index',
      );

      return packages;
    } catch (err) {
      logger.warn({ registryUrl, err }, 'Failed to fetch APK packages');
      throw err;
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
      () => this._getPackages(registryUrl),
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

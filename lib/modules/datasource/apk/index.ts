import { randomUUID } from 'node:crypto';
import { isNonEmptyArray } from '@sindresorhus/is';
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
import { constructComponentUrls } from './url.ts';

export const apkDatasourceId = 'apk';

const defaultConfig = {
  commitMessageTopic: '{{{depName}}} Alpine package',
  commitMessageExtra:
    'to {{#if isMajor}}{{{prettyNewMajor}}}{{else}}{{{prettyNewVersion}}}{{/if}}',
};

export class ApkDatasource extends Datasource {
  static readonly id = apkDatasourceId;

  override readonly defaultVersioning = looseVersioning;

  /**
   * Alpine APK repositories are laid out as
   * `{base}/{branch}/{component}/{arch}/APKINDEX.tar.gz`, and `/etc/apk/repositories`
   * holds one entry per component.
   *
   * For Renovate, the path segments are encoded as query parameters so that a single
   * registry URL can cover multiple components.
   *
   * The following query parameter is required:
   * - arch: e.g. x86_64, aarch64, armv7
   *
   * The following query parameters are optional, as repositories such as Wolfi serve
   * their index directly below the repository root:
   * - branch: latest-stable, v3.19, edge or any other Alpine branch
   * - components: comma separated list of components, e.g. main,community,testing
   */
  override readonly defaultRegistryUrls = [
    'https://dl-cdn.alpinelinux.org/alpine?branch=latest-stable&components=main&arch=x86_64',
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
   * Gets all available packages from a single APK component
   */
  private async _getPackages(componentUrl: string): Promise<ApkPackage[]> {
    logger.debug(`Fetching APK packages from ${componentUrl}`);

    const indexUrl = joinUrlParts(componentUrl, 'APKINDEX.tar.gz');
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
        { componentUrl, packageCount: packages.length },
        'Successfully parsed APK index',
      );

      return packages;
    } catch (err) {
      if (err instanceof HttpError) {
        const statusCode = err.response?.statusCode;
        if (statusCode === 429 || (statusCode && statusCode >= 500)) {
          throw new ExternalHostError(err);
        }
        logger.warn({ componentUrl, err }, 'Failed to fetch APK packages');
        throw err;
      }

      logger.warn({ err }, 'Error extracting APK index from tar.gz');
      return [];
    } finally {
      await fs.rmCache(cacheDir);
    }
  }

  private getPackages(componentUrl: string): Promise<ApkPackage[]> {
    return withCache(
      {
        namespace: `datasource-${ApkDatasource.id}`,
        key: componentUrl,
        ttlMinutes: 60,
        fallback: true,
        // Soft failures resolve to an empty list, which must not be cached as a valid index
        shouldCacheResult: isNonEmptyArray,
      },
      () => this._getPackages(componentUrl),
    );
  }

  /**
   * Gets releases for a specific package from APK repositories
   */
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore if -- should never happen */
    if (!registryUrl) {
      return null;
    }

    logger.debug(`Getting APK releases for ${packageName} from ${registryUrl}`);

    const componentUrls = constructComponentUrls(registryUrl);
    let result: ReleaseResult | null = null;

    for (const componentUrl of componentUrls) {
      try {
        const packages = await this.getPackages(componentUrl);

        // Find packages matching the requested package name
        const matchingPackages = packages.filter(
          (pkg) => pkg.name === packageName,
        );

        if (!matchingPackages.length) {
          logger.debug(
            { packageName, componentUrl },
            'No matching packages found',
          );
          continue;
        }

        // Convert packages to releases
        const releases = matchingPackages.map((pkg) => ({
          version: pkg.version,
          releaseTimestamp: pkg.buildDate
            ? asTimestamp(pkg.buildDate * 1000)
            : undefined,
        }));

        logger.trace(
          {
            packageName,
            componentUrl,
            releaseCount: releases.length,
            releases,
          },
          'Found APK releases',
        );

        result ??= { releases: [], registryUrl };
        result.homepage ??= matchingPackages.find((pkg) => pkg.url)?.url;
        result.releases.push(...releases);
      } catch (err) {
        if (err instanceof ExternalHostError) {
          throw err;
        }
        logger.debug(
          { packageName, componentUrl, err },
          'Skipping APK component due to an error',
        );
      }
    }

    return result;
  }
}

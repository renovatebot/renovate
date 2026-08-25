import { randomUUID } from 'node:crypto';
import { isNonEmptyObject } from '@sindresorhus/is';
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
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { parseApkIndexFile } from './parser.ts';
import type { ApkPackage } from './types.ts';
import { constructComponentUrls } from './url.ts';

export const apkDatasourceId = 'apk';

const defaultConfig = {
  commitMessageTopic: '{{{depName}}} APK package',
  commitMessageExtra:
    'to {{#if isMajor}}{{{prettyNewMajor}}}{{else}}{{{prettyNewVersion}}}{{/if}}',
};

/**
 * Groups packages by name so that a lookup does not scan the whole index.
 *
 * An index holds thousands of packages, and a name can appear more than once
 * when the component serves multiple versions of it.
 */
function groupPackagesByName(
  packages: ApkPackage[],
): Record<string, ApkPackage[]> {
  const packagesByName: Record<string, ApkPackage[]> = {};

  for (const pkg of packages) {
    packagesByName[pkg.name] ??= [];
    packagesByName[pkg.name].push(pkg);
  }

  return packagesByName;
}

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

  constructor() {
    super(ApkDatasource.id);
  }

  /**
   * Gets all available packages from a single APK component, keyed by package name
   */
  private async _getPackages(
    componentUrl: string,
  ): Promise<Record<string, ApkPackage[]>> {
    logger.debug(`Fetching APK packages from ${componentUrl}`);

    const extractId = randomUUID();
    const cacheDir = await fs.ensureCacheDir(upath.join('apk', extractId));
    const tarFile = upath.join(cacheDir, 'APKINDEX.tar.gz');
    const extractedFile = upath.join(cacheDir, 'APKINDEX');

    try {
      const indexUrl = joinUrlParts(componentUrl, 'APKINDEX.tar.gz');
      logger.debug(`Attempting to download ${indexUrl}`);
      const readStream = this.http.stream(indexUrl);
      const writeStream = fs.createCacheWriteStream(tarFile);
      await fs.pipeline(readStream, writeStream);

      await tarExtract({
        file: tarFile,
        cwd: cacheDir,
        filter: (path) => upath.basename(path) === 'APKINDEX',
      });

      if (!(await fs.cachePathExists(extractedFile))) {
        logger.warn({ componentUrl }, 'APKINDEX file not found in tar archive');
        return {};
      }

      logger.debug('Successfully extracted APKINDEX content');

      let packages: ApkPackage[] = [];
      try {
        packages = await parseApkIndexFile(extractedFile);
      } catch (err) {
        logger.warn({ componentUrl, err }, 'Error parsing APK index file');
        return {};
      }

      logger.debug(
        { componentUrl, packageCount: packages.length },
        'Successfully parsed APK index',
      );

      return groupPackagesByName(packages);
    } catch (err) {
      if (err instanceof HttpError) {
        const statusCode = err.response?.statusCode;
        if (statusCode === 429 || (statusCode && statusCode >= 500)) {
          throw new ExternalHostError(err);
        }
        // The caller logs the failure once for the component it was skipping
        throw err;
      }

      logger.warn(
        { componentUrl, err },
        'Error extracting APK index from tar.gz',
      );
      return {};
    } finally {
      await fs.rmCache(cacheDir);
    }
  }

  private getPackages(
    componentUrl: string,
  ): Promise<Record<string, ApkPackage[]>> {
    return withCache(
      {
        namespace: `datasource-${ApkDatasource.id}`,
        key: componentUrl,
        ttlMinutes: 60,
        fallback: true,
        // Soft failures resolve to an empty index, which must not be cached as a valid one
        shouldCacheResult: isNonEmptyObject,
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
    // A package can be served by more than one component, so the same version
    // must not be reported twice
    const seenVersions = new Set<string>();

    for (const componentUrl of componentUrls) {
      try {
        const packages = await this.getPackages(componentUrl);
        const matchingPackages = packages[packageName];

        if (!matchingPackages) {
          logger.debug(
            { packageName, componentUrl },
            'No matching packages found',
          );
          continue;
        }

        const releases: Release[] = [];
        for (const pkg of matchingPackages) {
          if (seenVersions.has(pkg.version)) {
            continue;
          }
          seenVersions.add(pkg.version);
          releases.push({
            version: pkg.version,
            releaseTimestamp: pkg.buildDate
              ? asTimestamp(pkg.buildDate * 1000)
              : undefined,
          });
        }

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

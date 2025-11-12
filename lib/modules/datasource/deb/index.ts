import readline from 'readline';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import * as fs from '../../../util/fs';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { packageKeys, requiredPackageKeys } from './common';
import { downloadAndExtractPackage } from './packages';
import { formatReleaseResult, releaseMetaInformationMatches } from './release';
import type { PackageDescription } from './types';
import { constructComponentUrls } from './url';

export class DebDatasource extends Datasource {
  static readonly id = 'deb';

  constructor() {
    super(DebDatasource.id);
  }

  /**
   * Users are able to specify custom Debian repositories as long as they follow
   * the Debian package repository format as specified here
   * @see{https://wiki.debian.org/DebianRepository/Format}
   */
  override readonly customRegistrySupport = true;

  /**
   * Users can specify multiple upstream repositories and the datasource will aggregate the release
   * @example
   * When specifying multiple dependencies both internal and external dependencies from internal/external artifactory
   */
  override readonly registryStrategy = 'merge';

  /**
   * The original apt source list file format is
   * deb uri distribution [component1] [component2] [...]
   * @see{https://wiki.debian.org/DebianRepository/Format}
   *
   * However, for Renovate, we require the registry URLs to be
   * valid URLs which is why the parameters are encoded in the URL.
   *
   * The following query parameters are required:
   * - components: comma separated list of components
   * - suite: stable, oldstable or other alias for a release, either this or release must be given like buster
   * - binaryArch: e.g. amd64 resolves to http://deb.debian.org/debian/dists/stable/non-free/binary-amd64/
   */
  override readonly defaultRegistryUrls = [
    'https://deb.debian.org/debian?suite=stable&components=main,contrib,non-free&binaryArch=amd64',
  ];

  override readonly defaultVersioning = 'deb';

  /**
   * Parses the extracted package index file.
   *
   * @param extractedFile - The path to the extracted package file.
   * @param lastTimestamp - The timestamp of the last modification.
   * @returns a list of packages with minimal Metadata.
   */
  @cache({
    namespace: `datasource-${DebDatasource.id}`,
    key: (extractedFile: string, lastTimestamp: Date) =>
      `${extractedFile}:${lastTimestamp.getTime()}`,
    ttlMinutes: 24 * 60,
  })
  async parseExtractedPackageIndex(
    extractedFile: string,
    _lastTimestamp: Date,
  ): Promise<Record<string, PackageDescription[]>> {
    // read line by line to avoid high memory consumption as the extracted Packages
    // files can be multiple MBs in size
    const rl = readline.createInterface({
      input: fs.createCacheReadStream(extractedFile),
      terminal: false,
    });

    let currentPackage: PackageDescription = {};
    // A Package Index can contain multiple Versions of the package on private Artifactory (e.g. Jfrog)
    const allPackages: Record<string, PackageDescription[]> = {};

    for await (const line of rl) {
      if (line === '') {
        // All information of the package are available, add to the list of packages
        if (requiredPackageKeys.every((key) => key in currentPackage)) {
          if (!allPackages[currentPackage.Package!]) {
            allPackages[currentPackage.Package!] = [];
          }
          allPackages[currentPackage.Package!].push(currentPackage);
          currentPackage = {};
        }
      } else {
        for (const key of packageKeys) {
          if (line.startsWith(`${key}:`)) {
            currentPackage[key] = line.substring(key.length + 1).trim();
            break;
          }
        }
      }
    }

    // Check the last package after file reading is complete
    if (requiredPackageKeys.every((key) => key in currentPackage)) {
      if (!allPackages[currentPackage.Package!]) {
        allPackages[currentPackage.Package!] = [];
      }
      allPackages[currentPackage.Package!].push(currentPackage);
    }

    return allPackages;
  }

  @cache({
    namespace: `datasource-${DebDatasource.id}`,
    key: (componentUrl: string) => componentUrl,
  })
  async getPackageIndex(
    componentUrl: string,
  ): Promise<Record<string, PackageDescription[]>> {
    const { extractedFile, lastTimestamp } = await downloadAndExtractPackage(
      componentUrl,
      this.http,
    );
    return await this.parseExtractedPackageIndex(extractedFile, lastTimestamp);
  }

  /**
   * Fetches the release information for a given package from the registry URL.
   *
   * @param config - Configuration for fetching releases.
   * @returns The release result if the package is found, otherwise null.
   */
  @cache({
    namespace: `datasource-${DebDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const componentUrls = constructComponentUrls(registryUrl);
    let aggregatedRelease: ReleaseResult | null = null;

    for (const componentUrl of componentUrls) {
      try {
        const packageIndex = await this.getPackageIndex(componentUrl);
        const parsedPackages = packageIndex[packageName];

        if (parsedPackages) {
          const newRelease = formatReleaseResult(parsedPackages);
          if (aggregatedRelease === null) {
            aggregatedRelease = newRelease;
          } else {
            if (!releaseMetaInformationMatches(aggregatedRelease, newRelease)) {
              logger.warn(
                { packageName },
                'Package occurred in more than one repository with different meta information. Aggregating releases anyway.',
              );
            }
            aggregatedRelease.releases.push(...newRelease.releases);
          }
        }
      } catch (error) {
        logger.debug(
          { componentUrl, error },
          'Skipping component due to an error',
        );
      }
    }

    return aggregatedRelease;
  }
}

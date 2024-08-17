import { createHash } from 'crypto';
import readline from 'readline';
import { createUnzip } from 'zlib';
import upath from 'upath';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import * as fs from '../../../util/fs';
import type { HttpOptions } from '../../../util/http/types';
import { joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { computeFileChecksum, parseChecksumsFromInRelease } from './checksum';
import { formatReleaseResult, releaseMetaInformationMatches } from './release';
import type { PackageDescription } from './types';
import { constructComponentUrls, getBaseReleaseUrl } from './url';
import { nanoid } from 'nanoid';

export class DebDatasource extends Datasource {
  static readonly id = 'deb';

  constructor() {
    super(DebDatasource.id);
  }

  /**
   * This is just an internal list of compressions that are supported and tried to be downloaded from the remote
   */
  static readonly compressions = ['gz'];

  /**
   * This specifies the directory where the extracted and downloaded packages files are stored relative to cacheDir.
   * The folder will be created automatically if it doesn't exist.
   */
  static readonly cacheSubDir: string = 'deb';

  /**
   * Users are able to specify custom Debian repositories as long as they follow
   * the Debian package repository format as specified here
   * @see{https://wiki.debian.org/DebianRepository/Format}
   */
  override readonly customRegistrySupport = true;

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
   * - suite: stable, oldstable or other alias for a release, either this or release must be given
   * - release: buster, etc.
   * - binaryArch: e.g. amd64 resolves to http://deb.debian.org/debian/dists/stable/non-free/binary-amd64/
   */
  override readonly defaultRegistryUrls = [
    'https://deb.debian.org/debian?suite=stable&components=main,contrib,non-free&binaryArch=amd64',
  ];

  override readonly defaultVersioning = 'deb';

  static requiredPackageKeys: Array<keyof PackageDescription> = [
    'Package',
    'Version',
  ];

  static packagesKeys: Array<keyof PackageDescription> = [
    ...DebDatasource.requiredPackageKeys,
    'Homepage',
  ];

  /**
   * Extracts the specified compressed file to the output file.
   *
   * @param compressedFile - The path to the compressed file.
   * @param compression - The compression method used (currently only 'gz' is supported).
   * @param outputFile - The path where the extracted content will be stored.
   * @throws Will throw an error if the compression method is unknown.
   */
  static async extract(
    compressedFile: string,
    compression: string,
    outputFile: string,
  ): Promise<void> {
    if (compression === 'gz') {
      const source = fs.createCacheReadStream(compressedFile);
      const destination = fs.createCacheWriteStream(outputFile);
      await fs.pipeline(source, createUnzip(), destination);
    } else {
      throw new Error(`Unsupported compression standard '${compression}'`);
    }
  }

  /**
   * Checks if the file exists and retrieves its creation time.
   *
   * @param filePath - The path to the file.
   * @returns The creation time if the file exists, otherwise undefined.
   */
  async getFileCreationTime(filePath: string): Promise<Date | undefined> {
    const stats = await fs.statCacheFile(filePath);
    return stats?.ctime;
  }

  /**
   * Downloads and extracts a package file from a component URL.
   *
   * @param componentUrl - The URL of the component.
   * @returns The path to the extracted file and the last modification timestamp.
   * @throws Will throw an error if no valid compression method is found.
   */
  async downloadAndExtractPackage(
    componentUrl: string,
  ): Promise<{ extractedFile: string; lastTimestamp: Date }> {
    const packageUrlHash = createHash('sha256')
      .update(componentUrl)
      .digest('hex');
    const fullCacheDir = await fs.ensureCacheDir(DebDatasource.cacheSubDir);
    const extractedFile = upath.join(fullCacheDir, `${packageUrlHash}.txt`);
    let lastTimestamp = await this.getFileCreationTime(extractedFile);

    for (const compression of DebDatasource.compressions) {
      const compressedFile = upath.join(
        fullCacheDir,
        `${nanoid()}_${packageUrlHash}.${compression}`,
      );

      let wasUpdated = false;

      try {
        wasUpdated = await this.downloadPackageFile(
          componentUrl,
          compression,
          compressedFile,
          lastTimestamp,
        );
      } catch (error) {
        logger.error(
          {
            compression,
            error: error.message,
          },
          `Failed to download package file from ${componentUrl}`,
        );

        continue;
      }

      if (wasUpdated || !lastTimestamp) {
        try {
          await DebDatasource.extract(
            compressedFile,
            compression,
            extractedFile,
          );
          lastTimestamp = await this.getFileCreationTime(extractedFile);
        } catch (error) {
          logger.error(
            {
              componentUrl,
              compression,
              error: error.message,
            },
            `Failed to extract package file from ${compressedFile}`,
          );
        } finally {
          await fs.rmCache(compressedFile);
        }
      }

      if (!lastTimestamp) {
        //extracting went wrong
        continue;
      }

      return { extractedFile, lastTimestamp };
    }

    throw new Error(`No compression standard worked for ${componentUrl}`);
  }

  /**
   * Downloads a package file if it has been modified since the last download timestamp.
   *
   * @param basePackageUrl - The base URL of the package.
   * @param compression - The compression method used (e.g., 'gz').
   * @param compressedFile - The path where the compressed file will be saved.
   * @param lastDownloadTimestamp - The timestamp of the last download.
   * @returns True if the file was downloaded, otherwise false.
   */
  async downloadPackageFile(
    basePackageUrl: string,
    compression: string,
    compressedFile: string,
    lastDownloadTimestamp?: Date,
  ): Promise<boolean> {
    const baseReleaseUrl = getBaseReleaseUrl(basePackageUrl);
    const packageUrl = joinUrlParts(basePackageUrl, `Packages.${compression}`);
    let needsToDownload = true;

    if (lastDownloadTimestamp) {
      needsToDownload = await this.checkIfModified(
        packageUrl,
        lastDownloadTimestamp,
      );
    }

    if (!needsToDownload) {
      logger.debug(`No need to download ${packageUrl}, file is up to date.`);
      return false;
    }
    const readStream = this.http.stream(packageUrl);
    const writeStream = fs.createCacheWriteStream(compressedFile);
    await fs.pipeline(readStream, writeStream);
    logger.debug(
      { url: packageUrl, targetFile: compressedFile },
      'Downloading Debian package file',
    );

    const actualChecksum = await computeFileChecksum(compressedFile);

    let inReleaseContent = '';

    try {
      inReleaseContent = await this.fetchInReleaseFile(baseReleaseUrl);
    } catch (error) {
      // This is expected to fail for Artifactory if GPG verification is not enabled
      logger.debug(
        { url: baseReleaseUrl, error },
        'Could not fetch InRelease file',
      );
    }

    if (inReleaseContent) {
      const expectedChecksum = parseChecksumsFromInRelease(
        inReleaseContent,
        // path to the Package.gz file
        packageUrl.replace(`${baseReleaseUrl}/`, ''),
      );
      if (actualChecksum !== expectedChecksum) {
        await fs.rmCache(compressedFile);
        throw new Error('SHA256 checksum validation failed');
      }
    }

    return needsToDownload;
  }

  /**
   * Fetches the content of the InRelease file from the given base release URL.
   *
   * @param baseReleaseUrl - The base URL of the release (e.g., 'https://deb.debian.org/debian/dists/bullseye').
   * @returns resolves to the content of the InRelease file.
   * @throws An error if the InRelease file could not be downloaded.
   */
  async fetchInReleaseFile(baseReleaseUrl: string): Promise<string> {
    const inReleaseUrl = joinUrlParts(baseReleaseUrl, 'InRelease');
    const response = await this.http.get(inReleaseUrl);
    return response.body;
  }

  /**
   * Checks if a packageUrl content has been modified since the specified timestamp.
   *
   * @param packageUrl - The URL to check.
   * @param lastDownloadTimestamp - The timestamp of the last download.
   * @returns True if the content has been modified, otherwise false.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since
   */
  async checkIfModified(
    packageUrl: string,
    lastDownloadTimestamp: Date,
  ): Promise<boolean> {
    const options: HttpOptions = {
      headers: {
        'If-Modified-Since': lastDownloadTimestamp.toUTCString(),
      },
    };

    try {
      const response = await this.http.head(packageUrl, options);
      return response.statusCode !== 304;
    } catch (error) {
      logger.warn(
        `Could not determine if ${packageUrl} is modified since ${lastDownloadTimestamp.toUTCString()}: ${error.message}`,
      );
      return true; // Assume it needs to be downloaded if check fails
    }
  }

  /**
   * Parses the extracted package index file.
   *
   * @param extractedFile - The path to the extracted package file.
   * @param lastTimestamp - The timestamp of the last modification.
   * @returns a list of packages with minimal Metadata.
   */
  @cache({
    namespace: `datasource-${DebDatasource.id}-package`,
    key: (extractedFile: string, lastTimestamp: Date) =>
      `${extractedFile}:${lastTimestamp.getTime()}`,
    ttlMinutes: 24 * 60,
  })
  async parseExtractedPackageIndex(
    extractedFile: string,
    lastTimestamp: Date,
  ): Promise<Record<string, PackageDescription>> {
    // read line by line to avoid high memory consumption as the extracted Packages
    // files can be multiple MBs in size
    const rl = readline.createInterface({
      input: fs.createCacheReadStream(extractedFile),
      terminal: false,
    });

    let currentPackage: PackageDescription = {};
    const allPackages: Record<string, PackageDescription> = {};

    for await (const line of rl) {
      if (line === '') {
        // All information of the package are available, add to the list of packages
        if (
          DebDatasource.requiredPackageKeys.every(
            (key) => key in currentPackage,
          )
        ) {
          allPackages[currentPackage.Package!] = currentPackage;
          currentPackage = {};
        }
      } else {
        for (const key of DebDatasource.packagesKeys) {
          if (line.startsWith(`${key}:`)) {
            currentPackage[key] = line.substring(key.length + 1).trim();
            break;
          }
        }
      }
    }

    // Check the last package after file reading is complete
    if (Object.keys(currentPackage).length > 0) {
      allPackages[currentPackage.Package!] = currentPackage;
    }

    return allPackages;
  }

  @cache({
    namespace: `datasource-${DebDatasource.id}-package`,
    key: (componentUrl: string) => componentUrl,
  })
  async getPackageIndex(
    componentUrl: string,
  ): Promise<Record<string, PackageDescription>> {
    const { extractedFile, lastTimestamp } =
      await this.downloadAndExtractPackage(componentUrl);
    return await this.parseExtractedPackageIndex(extractedFile, lastTimestamp);
  }

  /**
   * Fetches the release information for a given package from the registry URL.
   *
   * @param config - Configuration for fetching releases.
   * @returns The release result if the package is found, otherwise null.
   */
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const componentUrls = constructComponentUrls(registryUrl);
    let aggregatedRelease: ReleaseResult | null = null;

    for (const componentUrl of componentUrls) {
      try {
        const packageIndex = await this.getPackageIndex(componentUrl);
        const parsedPackage = packageIndex[packageName];

        if (parsedPackage) {
          const newRelease = formatReleaseResult(parsedPackage);
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

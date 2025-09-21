import { promisify } from 'util';
import * as zlib from 'zlib';
import * as tar from 'tar-stream';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { asTimestamp } from '../../../util/timestamp';
import { joinUrlParts } from '../../../util/url';
import { id as looseVersioning } from '../../versioning/loose';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { parseApkIndex } from './parser';
import type { ApkPackage } from './types';

export const apkDatasourceId = 'apk';

const defaultConfig = {
  commitMessageTopic: '{{{depName}}} Alpine package',
  commitMessageExtra:
    'to {{#if isMajor}}{{{prettyNewMajor}}}{{else}}{{{prettyNewVersion}}}{{/if}}',
};

export class ApkDatasource extends Datasource {
  static readonly id = apkDatasourceId;

  override readonly defaultVersioning = looseVersioning;

  override readonly defaultRegistryUrls = [
    'https://dl-cdn.alpinelinux.org/alpine/latest-stable/main',
  ];

  override readonly defaultConfig = defaultConfig;

  override readonly customRegistrySupport = true;

  constructor() {
    super(ApkDatasource.id);
  }

  /**
   * Fetches the APK index file from the repository
   */
  private async getApkIndex(registryUrl: string): Promise<string> {
    const indexUrl = joinUrlParts(registryUrl, 'x86_64', 'APKINDEX.tar.gz');

    try {
      logger.debug({ indexUrl }, 'Attempting to download APKINDEX.tar.gz');
      const response = await this.http.getBuffer(indexUrl);
      return await this.extractApkIndexFromTarGz(response.body);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.response?.statusCode === 404) {
          logger.debug(
            { registryUrl, indexUrl },
            'APK index not found at x86_64 architecture, trying without architecture path',
          );
          // Try without architecture path for some repositories
          const fallbackUrl = joinUrlParts(registryUrl, 'APKINDEX.tar.gz');
          logger.debug(
            { fallbackUrl },
            'Attempting to download fallback APKINDEX.tar.gz',
          );
          const fallbackResponse = await this.http.getBuffer(fallbackUrl);
          return await this.extractApkIndexFromTarGz(fallbackResponse.body);
        }
        if (err.response?.statusCode && err.response.statusCode >= 500) {
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
    try {
      logger.debug('Extracting APK index from tar.gz buffer');

      // First, decompress the gzip data
      const gunzip = promisify(zlib.gunzip);
      const decompressedBuffer = await gunzip(buffer);

      logger.debug(
        `Decompressed buffer size: ${decompressedBuffer.length} bytes`,
      );

      // Use tar-stream to extract the APKINDEX file
      return new Promise((resolve, reject) => {
        const extract = tar.extract();
        let apkIndexContent = '';
        let fileCount = 0;

        extract.on('entry', (header: any, stream: any, next: () => void) => {
          fileCount++;
          logger.debug(
            `Found file in tar: ${header.name} (size: ${header.size})`,
          );

          if (header.name === 'APKINDEX') {
            logger.debug('Found APKINDEX file in tar archive');

            const chunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
            });

            stream.on('end', () => {
              apkIndexContent = Buffer.concat(chunks).toString('utf8');
              next();
            });

            stream.on('error', (err: Error) => {
              logger.warn({ err }, 'Error reading APKINDEX file from tar');
              next();
            });
          } else {
            // Skip other files
            stream.resume();
            next();
          }
        });

        extract.on('finish', () => {
          logger.debug(`Processed ${fileCount} files in tar archive`);

          if (apkIndexContent) {
            logger.debug('Successfully extracted APKINDEX content');
            resolve(apkIndexContent);
          } else {
            logger.warn('APKINDEX file not found in tar archive');
            resolve('');
          }
        });

        extract.on('error', (err: Error) => {
          logger.warn({ err }, 'Error extracting tar archive');
          reject(err);
        });

        // Write the decompressed buffer to the extract stream
        extract.end(decompressedBuffer);
      });
    } catch (err) {
      logger.warn({ err }, 'Error extracting APK index from tar.gz');
      return '';
    }
  }

  /**
   * Gets all available packages from an APK repository
   */
  @cache({
    namespace: `datasource-${ApkDatasource.id}`,
    key: (registryUrl: string) => registryUrl,
    ttlMinutes: 60, // Cache for 1 hour
  })
  async getPackages(registryUrl: string): Promise<ApkPackage[]> {
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

  /**
   * Gets releases for a specific package from APK repositories
   */
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl) {
      logger.debug('No registry URL provided');
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

      logger.debug(
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

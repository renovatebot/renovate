import { createHash } from 'crypto';
import readline from 'readline';
import { createUnzip } from 'zlib';
import upath from 'upath';
import type { GetReleasesConfig, ReleaseResult } from '..';
import { logger } from '../../logger';
import * as fs from '../../util/fs';
import type { HttpOptions } from '../../util/http';
import { Datasource } from '../datasource';
import type { PackageDescription } from './types';

/**
 * @brief This datasource allows to download
 */
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
   * - binaryArch: e.g. amd64 resolves to http://ftp.debian.org/debian/dists/stable/non-free/binary-amd64/
   */
  override readonly defaultRegistryUrls = [
    'https://ftp.debian.org/debian?suite=stable&components=main,contrib,non-free&binaryArch=amd64',
  ];

  override readonly caching = true;

  /**
   * Here, we tell Renovate that this data source can respect multiple upstream repositories
   */
  override readonly registryStrategy = 'merge';

  /**
   * Not all Debian packages follow Semver, so it's wise to keep this loose but make sure to
   * have enough tests in your application.
   */
  override readonly defaultVersioning = 'loose';

  static requiredPackageKeys = ['Package', 'Version', 'Homepage'];

  static async extract(
    compressedFile: string,
    compression: string,
    outputFile: string
  ): Promise<void> {
    if (compression === 'gz') {
      const source = fs.createReadStream(compressedFile);
      const destination = fs.createWriteStream(outputFile);
      await fs.pipeline(source, createUnzip(), destination);
    } else {
      throw 'Unknown compression standard, this is probably a programming error';
    }
  }

  async downloadAndExtractPackage(componentUrl: string): Promise<string> {
    // we hash the package URL and export the hex to make it file system friendly
    // we use the hashed url as the filename for the local directories/files
    const hash = createHash('sha256');
    hash.update(componentUrl);
    const hashedPackageUrl = hash.digest('hex');

    const fullCacheDir = await fs.ensureCacheDir(DebDatasource.cacheSubDir);
    const extractedFile = upath.join(fullCacheDir, hashedPackageUrl + '.txt');
    const extractedFileExists = await fs.pathExists(extractedFile);

    let lastTimestamp: Date = null;
    if (extractedFileExists) {
      const stats = await fs.stat(extractedFile);
      lastTimestamp = stats.ctime;
    }

    for (let i = 0; i < DebDatasource.compressions.length; i++) {
      const compression = DebDatasource.compressions[i];
      const compressedFile = upath.join(
        fullCacheDir,
        hashedPackageUrl + '.' + compression
      );
      try {
        const wasUpdated = await this.downloadPackageFile(
          componentUrl,
          compression,
          compressedFile,
          lastTimestamp
        );
        if (wasUpdated || !extractedFileExists) {
          try {
            await DebDatasource.extract(
              compressedFile,
              compression,
              extractedFile
            );
          } finally {
            await fs.rm(compressedFile);
          }
        }
        return extractedFile;
      } catch (e) {
        logger.warn(
          {
            componentUrl: componentUrl,
            compression: compression,
          },
          "Couldn't download package file with compression"
        );
      }
    }

    throw 'No compression standard worked for ' + componentUrl;
  }

  /**
   *
   * @param cfg
   * @param basePackageUrl
   * @param compression
   * @param lastDownloadTimestamp indicating the last time the Packages file was requested,
   *                               set to null if no previous download has occurred
   * @returns a boolean indicating if the file was modified
   */
  async downloadPackageFile(
    basePackageUrl: string,
    compression: string,
    compressedFile: string,
    lastDownloadTimestamp: Date
  ): Promise<boolean> {
    const packageUrl = basePackageUrl + '/Packages.' + compression;
    logger.debug(
      {
        url: packageUrl,
        targetFile: compressedFile,
      },
      'Downloading Debian package file'
    );
    let needsToDownload = true;
    // we can use If-Modified-Since to avoid that we are redownloaded the file
    // More information can be found here: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since
    if (lastDownloadTimestamp !== null) {
      const downloadOptions: HttpOptions = {};
      downloadOptions.headers = {
        'If-Modified-Since': lastDownloadTimestamp.toUTCString(),
      };
      const headResult = await this.http.head(packageUrl, downloadOptions);
      needsToDownload = headResult.statusCode !== 304;
    }

    if (needsToDownload) {
      const readStream = this.http.stream(packageUrl);
      const writeStream = fs.createWriteStream(compressedFile);

      await fs.pipeline(readStream, writeStream);
    }

    return needsToDownload;
  }

  async probeExtractedPackage(
    extractedFile,
    packageName
  ): Promise<ReleaseResult | null> {
    // read line by line to avoid high memory consumption as the extracted Packages
    // files can be multiple MBs in size
    const rl = readline.createInterface({
      input: fs.createReadStream(extractedFile),
      terminal: false,
    });
    let pd: PackageDescription = {};
    for await (const line of rl) {
      if (line === '') {
        // now we should have all information available
        if (pd.Package === packageName) {
          return { releases: [{ version: pd.Version }], homepage: pd.Homepage };
        }
        pd = {};
        continue;
      }

      for (let i = 0; i < DebDatasource.requiredPackageKeys.length; i++) {
        if (line.startsWith(DebDatasource.requiredPackageKeys[i])) {
          pd[DebDatasource.requiredPackageKeys[i]] = line
            .substring(DebDatasource.requiredPackageKeys[i].length + 1)
            .trim();
          break;
        }
      }
    }

    // if the searched package is the last one, this is required
    if (pd.Package === packageName) {
      return { releases: [{ version: pd.Version }], homepage: pd.Homepage };
    }

    return null;
  }

  releaseMetaInformationMatches(
    lhs: ReleaseResult,
    rhs: ReleaseResult
  ): boolean {
    return lhs.homepage === rhs.homepage;
  }

  extractComponentUrls(registryUrl: string): string[] {
    let url: URL;
    try {
      url = new URL(registryUrl);
    } catch (e) {
      throw new Error(
        'Invalid deb repo url ' + registryUrl + ' - see documentation'
      );
    }
    if (!url.searchParams.has('components')) {
      throw new Error(
        'No components query parameter for deb repo url ' +
          registryUrl +
          ' - see documentation'
      );
    }

    let release: string;
    if (url.searchParams.has('release')) {
      release = url.searchParams.get('release');
    } else if (url.searchParams.has('suite')) {
      release = url.searchParams.get('suite');
    } else {
      throw new Error(
        'No release or suite query parameter for deb repo url ' +
          registryUrl +
          ' - see documentation'
      );
    }

    if (!url.searchParams.has('binaryArch')) {
      throw new Error(
        'No binaryArch query parameter for deb repo url ' +
          registryUrl +
          ' - see documentation'
      );
    }
    const binaryArch: string = url.searchParams.get('binaryArch');

    const components = url.searchParams.get('components').split(',');
    url.searchParams.delete('release');
    url.searchParams.delete('suite');
    url.searchParams.delete('components');
    url.searchParams.delete('binaryArch');

    url.pathname += '/dists/' + release;

    const fullComponentUrls: string[] = [];
    for (const component of components) {
      const newUrl = new URL(url);
      newUrl.pathname += '/' + component + '/binary-' + binaryArch;
      fullComponentUrls.push(newUrl.toString());
    }
    return fullComponentUrls;
  }

  async getReleases(cfg: GetReleasesConfig): Promise<ReleaseResult | null> {
    // when specifying n repository urls, getReleases will be called n times in each call,
    // cfg.registryUrl is filled with the next element of cfg.registryUrls so no need to manually
    // use registryUrls. However, to follow along with how the sources.list file looks like,
    // we allow multiple components per registry url.
    const fullComponentUrls = this.extractComponentUrls(cfg.registryUrl);

    let release: ReleaseResult = null;
    for (let i = 0; i < fullComponentUrls.length; i++) {
      let downloadedPackage: string;
      try {
        downloadedPackage = await this.downloadAndExtractPackage(
          fullComponentUrls[i]
        );
      } catch (e) {
        logger.warn(
          {
            componentUrl: fullComponentUrls[i],
            error: e,
          },
          'Skipping package because of error'
        );
        continue;
      }

      const newRelease = await this.probeExtractedPackage(
        downloadedPackage,
        cfg.lookupName
      );

      if (newRelease !== null) {
        if (release === null) {
          release = newRelease;
        } else {
          if (!this.releaseMetaInformationMatches(release, newRelease)) {
            logger.warn(
              {
                lookupName: cfg.lookupName,
              },
              'package occurred in more than one repository but with different meta information - still adding it'
            );
          }
          release.releases.push(newRelease.releases[0]);
        }
      }
    }

    return release;
  }
}

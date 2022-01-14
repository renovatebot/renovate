import { createHash } from 'crypto';
import readline from 'readline';
import { createUnzip } from 'zlib';
import type { GetReleasesConfig, ReleaseResult } from '..';
import { logger } from '../../logger';
import * as fs from '../../util/fs';
import type { HttpOptions } from '../../util/http';
import { Datasource } from '../datasource';
import type { DebLanguageConfig, PackageDescription } from './types';

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
   * This specifies the download directory into which the packages file should be downloaded relative to cacheDir.
   * The folder will be created automatically if it doesn't exist.
   */
  static readonly downloadDirectory = 'deb/download';

  /**
   * This specifies the directory where the extracted packages files are stored relative to cacheDir.
   * The folder will be created automatically if it doesn't exist.
   */
  static readonly extractionDirectory: 'deb/extracted';

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
   *
   * The following query parameters are optional:
   * - binaryArch: e.g. amd64 resolves to http://ftp.debian.org/debian/dists/stable/non-free/binary-amd64/
   */
  override readonly defaultRegistryUrls = [
    'https://ftp.debian.org/debian?suite=stable&components=main,contrib,non-free&binaryArch=amd64',
  ];

  override readonly defaultConfig: DebLanguageConfig = {
    deb: {
      defaultBinaryArch: 'amd64',
    },
  };

  override readonly caching = false; // TODO: how can this be used?

  /**
   * Here, we tell Renovate that this data source can respect multiple upstream repositories
   */
  override readonly registryStrategy = 'merge';

  /**
   * Not all Debian packages follow Semver, so it's wise to keep this loose but make sure to
   * have enough tests in your application.
   */
  override readonly defaultVersioning = 'loose';

  requiredPackageKeys = ['Package', 'Version', 'Homepage'];

  async initCacheDir(cfg: DebLanguageConfig): Promise<void> {
    await fs.ensureCacheDir(DebDatasource.downloadDirectory);
    await fs.ensureCacheDir(DebDatasource.extractionDirectory);
  }

  async extract(
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

  async downloadAndExtractPackage(
    cfg: DebLanguageConfig,
    basePackageUrl: string
  ): Promise<string> {
    // we hash the package URL and export the hex to make it file system friendly
    // we use the hashed url as the filename for the local directories/files
    const hash = createHash('sha256');
    hash.update(basePackageUrl);
    const hashedPackageUrl = hash.digest('hex');
    const downloadDirectory = await fs.ensureCacheDir(
      DebDatasource.downloadDirectory
    );

    const extractionDirectory = await fs.ensureCacheDir(
      DebDatasource.extractionDirectory
    );
    const extractedFile = extractionDirectory + '/' + hashedPackageUrl + '.txt';
    const extractedFileExists = await fs.pathExists(extractedFile);

    for (let i = 0; i < DebDatasource.compressions.length; i++) {
      const compression = DebDatasource.compressions[i];
      const compressedFile =
        downloadDirectory + '/' + hashedPackageUrl + '.' + compression;
      try {
        const wasUpdated = await this.downloadPackageFile(
          basePackageUrl,
          compression,
          compressedFile
        );
        if (wasUpdated || !extractedFileExists) {
          await this.extract(compressedFile, compression, extractedFile);
        }
        return extractedFile;
      } catch (e) {
        logger.warn(
          "Couldn't download package file with compression " +
            compression +
            ' from ' +
            basePackageUrl
        );
      }
    }

    throw 'No compression standard worked for ' + basePackageUrl;
  }

  /**
   *
   * @param cfg
   * @param basePackageUrl
   * @param compression
   * @returns a boolean indicating if the file was modified
   */
  async downloadPackageFile(
    basePackageUrl: string,
    compression: string,
    compressedFile: string
  ): Promise<boolean> {
    let lastTimestamp: Date = null;
    try {
      const stats = await fs.stat(compressedFile);
      lastTimestamp = stats.mtime;
    } catch (e) {
      // ignore if the file doesnt exist
    }

    const packageUri = basePackageUrl + '/Packages.' + compression;
    logger.debug(
      'Downloading package file from ' + packageUri + ' as ' + compressedFile
    );
    let needsToDownload = true;
    // we can use If-Modified-Since to avoid that we are redownloaded the file
    // More information can be found here: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since
    if (lastTimestamp !== null) {
      const downloadOptions: HttpOptions = {};
      downloadOptions.headers = {
        'If-Modified-Since': lastTimestamp.toUTCString(),
      };
      const headResult = await this.http.head(packageUri, downloadOptions);
      needsToDownload = headResult.statusCode !== 304;
    }

    if (needsToDownload) {
      const readStream = this.http.stream(packageUri);
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

      for (let i = 0; i < this.requiredPackageKeys.length; i++) {
        if (line.startsWith(this.requiredPackageKeys[i])) {
          pd[this.requiredPackageKeys[i]] = line
            .substring(this.requiredPackageKeys[i].length + 1)
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

  async getReleases(
    cfg: GetReleasesConfig & DebLanguageConfig
  ): Promise<ReleaseResult | null> {
    const fullComponentUrls: string[] = [];
    // when specifying n repository urls, this will be called n times in each call,
    // cfg.registryUrl is filled with the next element of cfg.registryUrls
    const registryUrls = [cfg.registryUrl];
    for (const aptUrl of registryUrls) {
      let url: URL;
      try {
        url = new URL(aptUrl);
      } catch (e) {
        logger.warn('Invalid deb repo url ' + aptUrl + ' - see documentation');
        continue;
      }
      if (!url.searchParams.has('components')) {
        logger.warn(
          'No components query parameter for deb repo url ' +
            aptUrl +
            ' - see documentation'
        );
        continue;
      }

      let release: string;
      if (url.searchParams.has('release')) {
        release = url.searchParams.get('release');
      } else if (url.searchParams.has('suite')) {
        release = url.searchParams.get('suite');
      } else {
        logger.warn(
          'No release or suite query parameter for deb repo url ' +
            aptUrl +
            ' - see documentation'
        );
        continue;
      }

      let binaryArch = cfg.deb.defaultBinaryArch;
      if (url.searchParams.has('binaryArch')) {
        binaryArch = url.searchParams.get('binaryArch');
      }

      const components = url.searchParams.get('components').split(',');
      url.searchParams.delete('release');
      url.searchParams.delete('suite');
      url.searchParams.delete('components');
      url.searchParams.delete('binaryArch');

      url.pathname += '/dists/' + release;
      for (const component of components) {
        const newUrl = new URL(url);
        newUrl.pathname += '/' + component + '/binary-' + binaryArch;
        fullComponentUrls.push(newUrl.toString());
      }
    }

    await this.initCacheDir(cfg);

    let release: ReleaseResult = null;
    for (let i = 0; i < fullComponentUrls.length; i++) {
      let downloadedPackage: string;
      try {
        downloadedPackage = await this.downloadAndExtractPackage(
          cfg,
          fullComponentUrls[i]
        );
      } catch (e) {
        logger.warn(
          'Skipping package ' +
            fullComponentUrls[i] +
            ' because of error ' +
            JSON.stringify(e)
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

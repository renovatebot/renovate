import { exec } from 'child_process';
import { createHash } from 'crypto';
import { createReadStream, existsSync, statSync } from 'fs';
import { performance } from 'perf_hooks';
import readline from 'readline';
import { promisify } from 'util';
import { GetReleasesConfig, ReleaseResult } from '..';
import { logger } from '../../logger';
import * as fs from '../../util/fs';
import { HttpOptions } from '../../util/http';
import { Datasource } from '../datasource';
import { DebLanguageConfig, PackageDescription } from './types';

/**
 * @brief This datasource allows to download
 */
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
   */
  override readonly defaultRegistryUrls = [
    'https://ftp.debian.org/debian?suite=stable&components=main,contrib,non-free',
  ];

  override readonly defaultConfig: DebLanguageConfig = {
    deb: {
      binaryArch: 'amd64',
      downloadDirectory: './others/deb/download',
      extractionDirectory: './others/deb/extracted',
    },
  };

  override readonly caching = false; // TODO: how can this be used?

  /**
   * Here, we tell Renovate that this data source can respect multiple upstream repositories
   */
  override readonly registryStrategy = 'merge';

  requiredPackageKeys = ['Package', 'Version', 'Homepage'];

  async initCacheDir(cfg: DebLanguageConfig): Promise<void> {
    await fs.ensureCacheDir(cfg.deb.downloadDirectory);
    await fs.ensureCacheDir(cfg.deb.extractionDirectory);
  }

  async runCommand(wd: string, command: string): Promise<void> {
    const pexec = promisify(exec);
    logger.trace('running command ' + command + ' in directory ' + wd);
    const { stdout, stderr } = await pexec(
      ['cd', '"' + wd + '"', '&&', command].join(' ')
    );
    logger.debug(stdout);
    logger.debug(stderr);
  }

  async downloadAndExtractPackage(
    cfg: DebLanguageConfig,
    packageUrl: string
  ): Promise<string> {
    // we hash the package URL and export the hex to make it file system friendly
    // we use the hashed url as the filename for the local directories/files
    const hash = createHash('sha256');
    hash.update(packageUrl);
    const hashedPackageUrl = hash.copy().digest('hex');
    const downloadDirectory = await fs.ensureCacheDir(
      cfg.deb.downloadDirectory
    );
    const compressedFile = downloadDirectory + '/' + hashedPackageUrl + '.xz';

    const extractionDirectory = await fs.ensureCacheDir(
      cfg.deb.extractionDirectory
    );
    const extractedFile = extractionDirectory + '/' + hashedPackageUrl + '.txt';

    let lastTimestamp: Date = null;
    try {
      const stats = statSync(compressedFile);
      lastTimestamp = stats.mtime;
    } catch (e) {
      // ignore if the file doesnt exist
    }

    logger.debug(
      'Downloading package file from ' + packageUrl + ' as ' + compressedFile
    );
    let needsToDownload = true;
    // we can use If-Modified-Since to avoid that we are redownloaded the file
    // More information can be found here: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since
    if (lastTimestamp !== null) {
      const downloadOptions: HttpOptions = {};
      downloadOptions.headers = {
        'If-Modified-Since': lastTimestamp.toUTCString(),
      };
      const headResult = await this.http.head(packageUrl, downloadOptions);
      needsToDownload = headResult.statusCode !== 304;
    }

    if (needsToDownload) {
      const readStream = this.http.stream(packageUrl);
      const writeStream = fs.createWriteStream(compressedFile);

      await fs.pipeline(readStream, writeStream);
    }

    // const stats = statSync(compressedFile);
    // const newTimestamp = stats.mtime;

    if (!needsToDownload && existsSync(extractedFile)) {
      logger.debug(
        "No need to extract file as wget didn't update the file and it exists"
      );
      return extractedFile;
    }

    logger.debug(
      'Extracting package file ' + compressedFile + ' to ' + extractedFile
    );
    /**
     * --threads=0 use all available cores
     * -k keep the downloaded file (needed by wget to not redownload)
     * -c print to stdout (we pipe)
     * -d decompress
     */
    await this.runCommand(
      downloadDirectory,
      ['xz --threads=0 -k -c -d', compressedFile, '>', extractedFile].join(' ')
    );

    return extractedFile;
  }

  async probeExtractedPackage(
    extractedFile,
    packageName
  ): Promise<ReleaseResult | null> {
    // read line by line to avoid high memory consumption as the extracted Packages
    // files can be multiple MBs in size
    const rl = readline.createInterface({
      input: createReadStream(extractedFile),
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

    return null;
  }

  async getReleases(
    cfg: GetReleasesConfig & DebLanguageConfig
  ): Promise<ReleaseResult | null> {
    const fullComponentUrls: string[] = [];
    const registryUrls = cfg.registryUrls || [cfg.registryUrl];
    registryUrls.forEach((aptUrl: string) => {
      let url: URL;
      try {
        url = new URL(aptUrl);
      } catch (e) {
        logger.warn('Invalid deb repo url ' + aptUrl + ' - see documentation');
        return;
      }
      if (!url.searchParams.has('components')) {
        logger.warn(
          'No components query parameter for deb repo url ' +
            aptUrl +
            ' - see documentation'
        );
        return;
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
        return;
      }

      const components = url.searchParams.get('components').split(',');
      url.searchParams.delete('release');
      url.searchParams.delete('suite');
      url.searchParams.delete('components');

      url.pathname += '/dists/' + release;
      components.forEach((component) => {
        const newUrl = new URL(url);
        newUrl.pathname +=
          '/' + component + '/binary-' + cfg.deb.binaryArch + '/Packages.xz';
        fullComponentUrls.push(newUrl.toString());
      });
    });

    await this.initCacheDir(cfg);

    let release: ReleaseResult = null;
    for (let i = 0; i < fullComponentUrls.length && release === null; i++) {
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

      const startTime = performance.now();
      release = await this.probeExtractedPackage(
        downloadedPackage,
        cfg.lookupName
      );
      const endTime = performance.now();
      logger.trace(`Inspected package file within  ${endTime - startTime} ms`);
    }

    return release;
  }
}

import { exec } from 'child_process';
import { createHash } from 'crypto';
import { createReadStream, existsSync, mkdirSync, statSync } from 'fs';
import { performance } from 'perf_hooks';
import readline from 'readline';
import { promisify } from 'util';
import { GetReleasesConfig, ReleaseResult } from '..';
import { logger } from '../../logger';
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
   * deb uri distribution [component1] [component2] [...]
   * @see{https://wiki.debian.org/DebianRepository/Format}
   */
  override readonly defaultRegistryUrls = [
    'deb https://ftp.debian.org/debian stable main contrib non-free',
  ];

  override readonly defaultConfig: DebLanguageConfig = {
    deb: {
      binaryArch: 'amd64',
      downloadDirectory: '/tmp/renovate-deb/packages-download',
      extractionDirectory: '/tmp/renovate-deb/packages',
    },
  };

  override readonly caching = false; // TODO: how can this be used?

  /**
   * Here, we tell Renovate that this data source can respect multiple upstream repositories
   */
  override readonly registryStrategy = 'merge';

  requiredPackageKeys = ['Package', 'Version', 'Homepage'];

  initCacheDir(cfg: DebLanguageConfig): void {
    mkdirSync(cfg.deb.downloadDirectory, { recursive: true });
    mkdirSync(cfg.deb.extractionDirectory, { recursive: true });
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
    const downloadLocation = cfg.deb.downloadDirectory + '/' + hashedPackageUrl;
    const compressedFile = downloadLocation + '/Packages.xz';
    const extractedFile =
      cfg.deb.extractionDirectory + '/' + hashedPackageUrl + '.txt';

    // curl will not modify the local file, if the upstream HTTP server
    // does not return a modified version. We can use this information
    // to not re-extract the same file again. For this to work we need
    // the current modification timestamp of the local package file.
    let lastTimestamp = -1;
    try {
      const stats = statSync(compressedFile);
      lastTimestamp = stats.mtime.getTime();
    } catch (e) {
      // ignore if the file doesnt exist
    }

    logger.debug(
      'Downloading package file from ' + packageUrl + ' as ' + downloadLocation
    );
    /**
     * curl -o "$file" -z "$file" "$uri"
     */
    mkdirSync(downloadLocation, { recursive: true });
    await this.runCommand(
      downloadLocation,
      ['curl', '-o', 'Packages.xz', '-z', 'Packages.xz', packageUrl].join(' ')
    );

    const stats = statSync(compressedFile);
    const newTimestamp = stats.mtime.getTime();

    if (newTimestamp <= lastTimestamp && existsSync(extractedFile)) {
      logger.debug(
        "No need to extract file as wget didn't update the file and it exists"
      );
      return extractedFile;
    }

    logger.debug(
      'Extracting package file ' + downloadLocation + ' to ' + extractedFile
    );
    /**
     * --threads=0 use all available cores
     * -k keep the downloaded file (needed by wget to not redownload)
     * -c print to stdout (we pipe)
     * -d decompress
     */
    await this.runCommand(
      downloadLocation,
      ['xz --threads=0 -k -c -d', 'Packages.xz', '>', extractedFile].join(' ')
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
      const aptUrlSplit = aptUrl.split(' ');
      if (aptUrlSplit.length < 4) {
        logger.warn(
          'Skipping invalid apt repository url ' +
            aptUrl +
            ' - has invalid number of elements'
        );
        return;
      } else if (aptUrlSplit[0] !== 'deb') {
        logger.warn(
          'Skipping invalid apt repository url ' +
            aptUrl +
            ' - can only deal with "deb" repos'
        );
        return;
      }
      let baseUrl: URL;
      try {
        baseUrl = new URL(aptUrlSplit[1]);
      } catch (e) {
        logger.warn(
          'Skipping invalid apt repository url ' +
            aptUrl +
            ' - got error while parsing URL - ' +
            JSON.stringify(e)
        );
        return;
      }
      baseUrl.pathname += '/dists/' + aptUrlSplit[2];

      // now we are at the components, we require at least one but can have multiple components
      for (let i = 3; i < aptUrlSplit.length; i++) {
        const newUrl = new URL(baseUrl);
        newUrl.pathname +=
          '/' +
          aptUrlSplit[i] +
          '/binary-' +
          cfg.deb.binaryArch +
          '/Packages.xz';
        fullComponentUrls.push(newUrl.toString());
      }
    });

    this.initCacheDir(cfg);

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

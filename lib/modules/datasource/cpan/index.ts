import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { getElapsedMinutes } from '../../../util/date';
import { newlineRegex, regEx } from '../../../util/regex';
import { copystr } from '../../../util/string';
import { joinUrlParts } from '../../../util/url';
import * as perlVersioning from '../../versioning/perl';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

type Package = {
  release: Release;
  distribution: string;
};

let lastSync = new Date('2000-01-01');
let packages: Record<string, Package> = Object.create(null); // Because we might need a "constructor" key
let contentLength = 0;

const pathExtensionPattern = regEx(/(\.tgz|\.tar\.gz)$/);
const pathPattern = regEx(/^.+\/(.+)-(?:\d+(?:\.\d+)*)(?:\.tgz|\.tar\.gz)$/);

// Note: use only for tests
export function resetCache(): void {
  lastSync = new Date('2000-01-01');
  packages = Object.create(null);
  contentLength = 0;
}

export class CpanDatasource extends Datasource {
  static readonly id = 'cpan';

  constructor() {
    super(CpanDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://www.cpan.org'];

  override readonly defaultVersioning = perlVersioning.id;

  @cache({
    namespace: `datasource-${CpanDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `${packageName}`,
  })
  override async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    await this.syncVersions(registryUrl);
    const pkg = packages[packageName];
    if (!pkg) {
      return null;
    }
    const dep: ReleaseResult = {
      releases: [pkg.release],
      changelogUrl: `https://metacpan.org/dist/${pkg.distribution}/changes`,
      homepage: `https://metacpan.org/pod/${packageName}`,
    };
    return dep;
  }

  async updateCpanVersions(registryUrl: string): Promise<void> {
    const url = joinUrlParts(registryUrl, 'modules', '02packages.details.txt');
    const options = {
      headers: {
        'accept-encoding': 'identity',
        range: `bytes=${contentLength}-`,
      },
    };
    let newLines: string;
    try {
      logger.trace({ registryUrl }, 'Fetching 02packages.details.txt');
      const startTime = Date.now();
      newLines = (await this.http.get(url, options)).body;
      const durationMs = Math.round(Date.now() - startTime);
      logger.trace(
        { registryUrl, durationMs },
        'Fetched 02packages.details.txt'
      );
    } catch (err) /* istanbul ignore next */ {
      if (err.statusCode !== 416) {
        contentLength = 0;
        packages = Object.create(null); // Because we might need a "constructor" key
        logger.trace({ registryUrl, err }, 'fetch error');
        throw new ExternalHostError(new Error('CPAN fetch error'));
      }
      logger.trace({ registryUrl }, 'No update');
      lastSync = new Date();
      return;
    }

    for (const line of newLines.split(newlineRegex)) {
      CpanDatasource.processLine(line);
    }
    lastSync = new Date();
  }

  private static processLine(line: string): void {
    let split: string[] | undefined;
    let pkg: string | undefined;
    let latestVersion: string | undefined;
    let path: string | undefined;
    try {
      const l = line.trim();
      if (!l.length || !pathExtensionPattern.test(l)) {
        return;
      }
      split = l.split(/\s+/);
      [pkg, latestVersion, path] = split;
      pkg = copystr(pkg);
      const distribution = path.replace(pathPattern, '$1');
      packages[pkg] = {
        release: {
          version: latestVersion,
          isStable: !latestVersion.includes('_'),
        },
        distribution,
      };
    } catch (err) /* istanbul ignore next */ {
      logger.warn(
        { err, line, split, pkg, latestVersion, path },
        'CPAN line parsing error'
      );
    }
  }

  private static isDataStale(): boolean {
    return getElapsedMinutes(lastSync) >= 5;
  }

  private updateCpanVersionsPromise: Promise<void> | null = null;

  async syncVersions(registryUrl: string): Promise<void> {
    if (CpanDatasource.isDataStale()) {
      this.updateCpanVersionsPromise =
        this.updateCpanVersionsPromise ?? this.updateCpanVersions(registryUrl);
      await this.updateCpanVersionsPromise;
      this.updateCpanVersionsPromise = null;
    }
  }
}

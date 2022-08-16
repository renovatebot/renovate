import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { getElapsedMinutes } from '../../../util/date';
import { HttpError } from '../../../util/http';
import { newlineRegex } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

type RegistryCache = {
  lastSync: Date;
  packageReleases: Record<string, string[]>; // Because we might need a "constructor" key
  contentLength: number;
  isSupported: boolean;
};

const registryCaches: { [key: string]: RegistryCache } = {};

// Note: use only for tests
export function resetCache(): void {
  Object.keys(registryCaches).forEach((key) => {
    registryCaches[key].lastSync = new Date('2000-01-01');
    registryCaches[key].packageReleases = Object.create(null);
    registryCaches[key].contentLength = 0;
    registryCaches[key].isSupported = false;
  });
}

export class VersionsDatasource extends Datasource {
  private registryUrl: string;
  private registryCache: RegistryCache;

  constructor(override readonly id: string, registryUrl: string) {
    super(id);
    this.registryUrl = registryUrl;
    if (!registryCaches[registryUrl]) {
      registryCaches[registryUrl] = {
        lastSync: new Date('2000-01-01'),
        packageReleases: Object.create(null),
        contentLength: 0,
        isSupported: false,
      };
    }
    this.registryCache = registryCaches[registryUrl];
  }

  async getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.debug(`getRubygemsOrgDependency(${packageName})`);
    await this.syncVersions();
    if (!this.registryCache.isSupported) {
      const err = new ExternalHostError(
        new Error(`${this.registryUrl} is not supported`)
      );
      err.reason = 'not_supported';
      throw err;
    }
    if (!this.registryCache.packageReleases[packageName]) {
      return null;
    }
    const dep: ReleaseResult = {
      releases: this.registryCache.packageReleases[packageName].map(
        (version) => ({
          version,
        })
      ),
    };
    return dep;
  }

  /**
   * https://bugs.chromium.org/p/v8/issues/detail?id=2869
   */
  private static copystr(x: string): string {
    return (' ' + x).slice(1);
  }

  async updateRubyGemsVersions(): Promise<void> {
    const url = `${this.registryUrl}/versions`;
    const options = {
      headers: {
        'accept-encoding': 'identity',
        range: `bytes=${this.registryCache.contentLength}-`,
      },
    };
    let newLines: string;
    try {
      logger.debug('Rubygems: Fetching rubygems.org versions');
      const startTime = Date.now();
      newLines = (await this.http.get(url, options)).body;
      const durationMs = Math.round(Date.now() - startTime);
      logger.debug({ durationMs }, 'Rubygems: Fetched rubygems.org versions');
      this.registryCache.isSupported = true;
    } catch (err) /* istanbul ignore next */ {
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        this.registryCache.isSupported = false;
        return;
      }
      if (err.statusCode !== 416) {
        this.registryCache.contentLength = 0;
        this.registryCache.packageReleases = Object.create(null); // Because we might need a "constructor" key
        logger.debug({ err }, 'Rubygems fetch error');
        throw new ExternalHostError(new Error('Rubygems fetch error'));
      }
      logger.debug('Rubygems: No update');
      this.registryCache.lastSync = new Date();
      return;
    }

    for (const line of newLines.split(newlineRegex)) {
      this.processLine(line);
    }
    this.registryCache.lastSync = new Date();
  }

  private processLine(line: string): void {
    let split: string[] | undefined;
    let pkg: string | undefined;
    let versions: string | undefined;
    try {
      const l = line.trim();
      if (!l.length || l.startsWith('created_at:') || l === '---') {
        return;
      }
      split = l.split(' ');
      [pkg, versions] = split;
      pkg = VersionsDatasource.copystr(pkg);
      this.registryCache.packageReleases[pkg] =
        this.registryCache.packageReleases[pkg] || [];
      const lineVersions = versions.split(',').map((version) => version.trim());
      for (const lineVersion of lineVersions) {
        if (lineVersion.startsWith('-')) {
          const deletedVersion = lineVersion.slice(1);
          logger.trace({ pkg, deletedVersion }, 'Rubygems: Deleting version');
          this.registryCache.packageReleases[pkg] =
            this.registryCache.packageReleases[pkg].filter(
              (version) => version !== deletedVersion
            );
        } else {
          this.registryCache.packageReleases[pkg].push(
            VersionsDatasource.copystr(lineVersion)
          );
        }
      }
    } catch (err) /* istanbul ignore next */ {
      logger.warn(
        { err, line, split, pkg, versions },
        'Rubygems line parsing error'
      );
    }
  }

  private isDataStale(): boolean {
    return getElapsedMinutes(this.registryCache.lastSync) >= 15;
  }

  private updateRubyGemsVersionsPromise: Promise<void> | null = null;

  async syncVersions(): Promise<void> {
    if (this.isDataStale()) {
      this.updateRubyGemsVersionsPromise =
        this.updateRubyGemsVersionsPromise ?? this.updateRubyGemsVersions();
      await this.updateRubyGemsVersionsPromise;
      this.updateRubyGemsVersionsPromise = null;
    }
  }
}

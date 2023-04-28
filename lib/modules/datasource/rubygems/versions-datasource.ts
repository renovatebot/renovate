import { PAGE_NOT_FOUND_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as memCache from '../../../util/cache/memory';
import { getElapsedMinutes } from '../../../util/date';
import { HttpError } from '../../../util/http';
import { newlineRegex } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

interface RegistryCache {
  lastSync: Date;
  packageReleases: Record<string, string[]>; // Because we might need a "constructor" key
  contentLength: number;
  isSupported: boolean;
  registryUrl: string;
}

export class VersionsDatasource extends Datasource {
  constructor(override readonly id: string) {
    super(id);
  }

  getRegistryCache(registryUrl: string): RegistryCache {
    const cacheKey = `rubygems-versions-cache:${registryUrl}`;
    const regCache = memCache.get<RegistryCache>(cacheKey) ?? {
      lastSync: new Date('2000-01-01'),
      packageReleases: {},
      contentLength: 0,
      isSupported: false,
      registryUrl,
    };
    memCache.set(cacheKey, regCache);
    return regCache;
  }

  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.debug(`getRubygemsOrgDependency(${packageName})`);

    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }
    const regCache = this.getRegistryCache(registryUrl);

    await this.syncVersions(regCache);

    if (!regCache.isSupported) {
      throw new Error(PAGE_NOT_FOUND_ERROR);
    }

    if (!regCache.packageReleases[packageName]) {
      return null;
    }

    const releases = regCache.packageReleases[packageName].map((version) => ({
      version,
    }));
    return { releases };
  }

  /**
   * https://bugs.chromium.org/p/v8/issues/detail?id=2869
   */
  private static copystr(x: string): string {
    return (' ' + x).slice(1);
  }

  async updateRubyGemsVersions(regCache: RegistryCache): Promise<void> {
    const url = `${regCache.registryUrl}/versions`;
    const options = {
      headers: {
        'accept-encoding': 'identity',
        range: `bytes=${regCache.contentLength}-`,
      },
    };
    let newLines: string;
    try {
      logger.debug('Rubygems: Fetching rubygems.org versions');
      const startTime = Date.now();
      newLines = (await this.http.get(url, options)).body;
      const durationMs = Math.round(Date.now() - startTime);
      logger.debug(`Rubygems: Fetched rubygems.org versions in ${durationMs}`);
      regCache.isSupported = true;
    } catch (err) /* istanbul ignore next */ {
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        regCache.isSupported = false;
        return;
      }
      if (err.statusCode !== 416) {
        regCache.contentLength = 0;
        regCache.packageReleases = {};
        logger.debug({ err }, 'Rubygems fetch error');
        throw new ExternalHostError(new Error('Rubygems fetch error'));
      }
      logger.debug('Rubygems: No update');
      regCache.lastSync = new Date();
      return;
    }

    for (const line of newLines.split(newlineRegex)) {
      this.processLine(regCache, line);
    }
    regCache.lastSync = new Date();
  }

  private processLine(regCache: RegistryCache, line: string): void {
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
      regCache.packageReleases[pkg] ??= [];
      const lineVersions = versions.split(',').map((version) => version.trim());
      for (const lineVersion of lineVersions) {
        if (lineVersion.startsWith('-')) {
          const deletedVersion = lineVersion.slice(1);
          logger.trace({ pkg, deletedVersion }, 'Rubygems: Deleting version');
          regCache.packageReleases[pkg] = regCache.packageReleases[pkg].filter(
            (version) => version !== deletedVersion
          );
        } else {
          regCache.packageReleases[pkg].push(
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

  private isDataStale({ lastSync }: RegistryCache): boolean {
    return getElapsedMinutes(lastSync) >= 15;
  }

  private updateRubyGemsVersionsPromise: Promise<void> | null = null;

  async syncVersions(regCache: RegistryCache): Promise<void> {
    if (this.isDataStale(regCache)) {
      this.updateRubyGemsVersionsPromise =
        this.updateRubyGemsVersionsPromise ??
        this.updateRubyGemsVersions(regCache);
      await this.updateRubyGemsVersionsPromise;
      this.updateRubyGemsVersionsPromise = null;
    }
  }
}

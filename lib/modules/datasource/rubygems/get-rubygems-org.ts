import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { getElapsedMinutes } from '../../../util/date';
import { newlineRegex } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

let lastSync = new Date('2000-01-01');
let packageReleases: Record<string, string[]> = Object.create(null); // Because we might need a "constructor" key
let contentLength = 0;

// Note: use only for tests
export function resetCache(): void {
  lastSync = new Date('2000-01-01');
  packageReleases = Object.create(null);
  contentLength = 0;
}

export class RubyGemsOrgDatasource extends Datasource {
  constructor(override readonly id: string) {
    super(id);
  }

  async getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.debug(`getRubygemsOrgDependency(${packageName})`);
    await this.syncVersions();
    if (!packageReleases[packageName]) {
      return null;
    }
    const dep: ReleaseResult = {
      releases: packageReleases[packageName].map((version) => ({
        version,
      })),
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
    const url = 'https://rubygems.org/versions';
    const options = {
      headers: {
        'accept-encoding': 'identity',
        range: `bytes=${contentLength}-`,
      },
    };
    let newLines: string;
    try {
      logger.debug('Rubygems: Fetching rubygems.org versions');
      const startTime = Date.now();
      newLines = (await this.http.get(url, options)).body;
      const durationMs = Math.round(Date.now() - startTime);
      logger.debug({ durationMs }, 'Rubygems: Fetched rubygems.org versions');
    } catch (err) /* istanbul ignore next */ {
      if (err.statusCode !== 416) {
        contentLength = 0;
        packageReleases = Object.create(null); // Because we might need a "constructor" key
        //logger.debug(err)
        logger.debug(err);
        throw new ExternalHostError(new Error('Rubygems fetch error.'));
      }
      logger.debug('Rubygems: No update');
      lastSync = new Date();
      return;
    }

    for (const line of newLines.split(newlineRegex)) {
      RubyGemsOrgDatasource.processLine(line);
    }
    lastSync = new Date();
  }

  private static processLine(line: string): void {
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
      pkg = RubyGemsOrgDatasource.copystr(pkg);
      packageReleases[pkg] = packageReleases[pkg] || [];
      const lineVersions = versions.split(',').map((version) => version.trim());
      for (const lineVersion of lineVersions) {
        if (lineVersion.startsWith('-')) {
          const deletedVersion = lineVersion.slice(1);
          logger.trace({ pkg, deletedVersion }, 'Rubygems: Deleting version');
          packageReleases[pkg] = packageReleases[pkg].filter(
            (version) => version !== deletedVersion
          );
        } else {
          packageReleases[pkg].push(RubyGemsOrgDatasource.copystr(lineVersion));
        }
      }
    } catch (err) /* istanbul ignore next */ {
      logger.warn(
        { err, line, split, pkg, versions },
        'Rubygems line parsing error'
      );
    }
  }

  private static isDataStale(): boolean {
    return getElapsedMinutes(lastSync) >= 5;
  }

  private updateRubyGemsVersionsPromise: Promise<void> | null = null;

  async syncVersions(): Promise<void> {
    if (RubyGemsOrgDatasource.isDataStale()) {
      this.updateRubyGemsVersionsPromise =
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.updateRubyGemsVersionsPromise || this.updateRubyGemsVersions();
      await this.updateRubyGemsVersionsPromise;
      this.updateRubyGemsVersionsPromise = null;
    }
  }
}

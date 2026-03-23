import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { HttpError } from '../../../util/http/index.ts';
import { id as versioning } from '../../versioning/python/index.ts';
import { Datasource } from '../datasource.ts';
import { registryUrl as eolRegistryUrl } from '../endoflife-date/common.ts';
import { EndoflifeDateDatasource } from '../endoflife-date/index.ts';
import { GithubReleasesDatasource } from '../github-releases/index.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { datasource, defaultRegistryUrl, githubBaseUrl } from './common.ts';
import { PythonRelease } from './schema.ts';

export class PythonVersionDatasource extends Datasource {
  static readonly id = datasource;
  pythonPrebuildDatasource: GithubReleasesDatasource;
  pythonEolDatasource: EndoflifeDateDatasource;

  constructor() {
    super(datasource);
    this.pythonPrebuildDatasource = new GithubReleasesDatasource();
    this.pythonEolDatasource = new EndoflifeDateDatasource();
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly defaultVersioning = versioning;

  override readonly caching = true;

  async getPrebuildReleases(): Promise<ReleaseResult | null> {
    return await this.pythonPrebuildDatasource.getReleases({
      registryUrl: githubBaseUrl,
      packageName: 'containerbase/python-prebuild',
    });
  }

  async getEolReleases(): Promise<ReleaseResult | null> {
    return await this.pythonEolDatasource.getReleases({
      registryUrl: eolRegistryUrl,
      packageName: 'python',
    });
  }

  private async _getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }
    const pythonPrebuildReleases = await this.getPrebuildReleases();
    const pythonPrebuildVersions = new Set<string>(
      pythonPrebuildReleases?.releases.map((release) => release.version),
    );
    const pythonEolReleases = await this.getEolReleases();
    const pythonEolVersions = new Map(
      pythonEolReleases?.releases
        .filter((release) => release.isDeprecated !== undefined)
        .map((release) => [
          release.version.split('.').slice(0, 2).join('.'),
          release.isDeprecated,
        ]),
    );
    const result: ReleaseResult = {
      homepage: 'https://python.org',
      sourceUrl: 'https://github.com/python/cpython',
      registryUrl,
      releases: [],
    };
    try {
      const response = await this.http.getJson(registryUrl, PythonRelease);
      result.releases.push(
        ...response.body
          .filter((release) => release.isStable)
          .filter((release) => pythonPrebuildVersions.has(release.version)),
      );
    } catch (err) {
      if (err instanceof HttpError && err.response?.statusCode === 429) {
        logger.debug(
          { err },
          'Rate limited by python.org, using prebuild releases',
        );
        result.releases.push(...(pythonPrebuildReleases?.releases ?? []));
      } else {
        this.handleGenericErrors(err);
      }
    }
    for (const release of result.releases) {
      release.isDeprecated = pythonEolVersions.get(
        release.version.split('.').slice(0, 2).join('.'),
      );
    }

    return result.releases.length ? result : null;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${datasource}`,
        key: `${config.registryUrl}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}

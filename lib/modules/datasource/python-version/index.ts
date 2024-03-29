import { cache } from '../../../util/cache/package/decorator';
import { id as versioning } from '../../versioning/python';
import { Datasource } from '../datasource';
import { EndoflifeDatePackagesource } from '../endoflife-date';
import { registryUrl as eolRegistryUrl } from '../endoflife-date/common';
import { GithubReleasesDatasource } from '../github-releases';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl, githubBaseUrl } from './common';
import { PythonRelease } from './schema';

export class PythonVersionDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
    PythonVersionDatasource.pythonPrebuildDatasource =
      new GithubReleasesDatasource();
    PythonVersionDatasource.pythonEolDatasource =
      new EndoflifeDatePackagesource();
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly defaultVersioning = versioning;

  override readonly caching = true;

  static pythonPrebuildDatasource: GithubReleasesDatasource;

  static async getPrebuildReleases(): Promise<ReleaseResult | null> {
    return await PythonVersionDatasource.pythonPrebuildDatasource.getReleases({
      registryUrl: githubBaseUrl,
      packageName: 'containerbase/python-prebuild',
    });
  }

  static pythonEolDatasource: EndoflifeDatePackagesource;

  static async getEolReleases(): Promise<ReleaseResult | null> {
    return await PythonVersionDatasource.pythonEolDatasource.getReleases({
      registryUrl: eolRegistryUrl,
      packageName: 'python',
    });
  }

  @cache({
    namespace: `datasource-${datasource}`,
    // TODO: types (#22198)
    key: ({ registryUrl }: GetReleasesConfig) => `${registryUrl}`,
  })
  async getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }
    const pythonPrebuildReleases =
      await PythonVersionDatasource.getPrebuildReleases();
    const pythonPrebuildVersions = new Set<string>(
      pythonPrebuildReleases?.releases.map((release) => release.version),
    );
    const pythonEolReleases = await PythonVersionDatasource.getEolReleases();
    const pythonEolVersions = new Map<string, boolean | undefined>(
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
          .filter((release) => pythonPrebuildVersions?.has(release.version)),
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }
    for (const release of result.releases) {
      release.isDeprecated = pythonEolVersions.get(
        release.version.split('.').slice(0, 2).join('.'),
      );
    }

    return result.releases.length ? result : null;
  }
}

import { satisfies } from '@renovatebot/pep440';
import { cache } from '../../../util/cache/package/decorator';
import { id as versioning } from '../../versioning/python';
import { Datasource } from '../datasource';
import { EndoflifeDatePackagesource } from '../endoflife-date';
import { GithubReleasesDatasource } from '../github-releases';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl } from './common';
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

  static pythonEolDatasource: EndoflifeDatePackagesource;

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
      await PythonVersionDatasource.pythonPrebuildDatasource.getReleases({
        packageName: 'containerbase/python-prebuild',
      });
    const pythonPrebuildVersions = new Set<string>(
      pythonPrebuildReleases?.releases.map((release) => release.version),
    );
    const pythonEolVersions =
      await PythonVersionDatasource.pythonEolDatasource.getReleases({
        packageName: 'python',
      });
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
          .filter((release) => !pythonPrebuildVersions?.has(release.version)),
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }
    for (const release of result.releases) {
      release.isDeprecated = pythonEolVersions?.releases.find((cycle) =>
        satisfies(release.version, '==' + cycle.version),
      )?.isDeprecated;
    }

    return result.releases.length ? result : null;
  }
}

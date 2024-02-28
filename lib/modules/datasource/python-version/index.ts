import { cache } from '../../../util/cache/package/decorator';
import { id as versioning } from '../../versioning/python';
import { Datasource } from '../datasource';
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
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly defaultVersioning = versioning;

  override readonly caching = true;

  static pythonPrebuildDatasource: GithubReleasesDatasource;

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
    const pythonPrebuildVersions = pythonPrebuildReleases?.releases.map(
      (release) => release.version,
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
          .filter(
            (release) => !pythonPrebuildVersions?.includes(release.version),
          ),
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}

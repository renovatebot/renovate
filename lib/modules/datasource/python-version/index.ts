import { join } from 'path';
import { cache } from '../../../util/cache/package/decorator';
import { id as versioning } from '../../versioning/pep440';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl } from './common';
import type { PythonRelease } from './types';
import { joinUrlParts } from '../../../util/url';

export class PythonVersionDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly defaultVersioning = versioning;

  override readonly caching = true;

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
    const result: ReleaseResult = {
      homepage: 'https://python.org',
      sourceUrl: 'https://github.com/python/cpython',
      registryUrl,
      releases: [],
    };
    try {
      const resp = (
        await this.http.getJson<PythonRelease[]>(joinUrlParts(registryUrl, '/'))
      ).body;
      for (const release of resp) {
        const version = release.name.replace('Python', '').trim();
        result.releases.push({
          version,
          releaseTimestamp: release.release_date,
          isStable: !release.pre_release!,
        });
      }
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}

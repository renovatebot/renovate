import { cache } from '../../../util/cache/package/decorator';
import { joinUrlParts } from '../../../util/url';
import { id as versioning } from '../../versioning/node';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl } from './common';
import type { NodeRelease } from './types';

export class NodeVersionDatasource extends Datasource {
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
      homepage: 'https://nodejs.org',
      sourceUrl: 'https://github.com/nodejs/node',
      registryUrl,
      releases: [],
    };
    try {
      const resp = (
        await this.http.getJson<NodeRelease[]>(
          joinUrlParts(registryUrl, 'index.json'),
        )
      ).body;
      result.releases.push(
        ...resp.map(({ version, date, lts }) => ({
          version,
          releaseTimestamp: date,
          isStable: lts !== false,
        })),
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}

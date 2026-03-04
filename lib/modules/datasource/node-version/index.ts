import { withCache } from '../../../util/cache/package/with-cache.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { id as versioning } from '../../versioning/node/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { datasource, defaultRegistryUrl } from './common.ts';
import type { NodeRelease } from './types.ts';

export class NodeVersionDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly defaultVersioning = versioning;

  override readonly caching = true;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `date` field.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'We use the URL: https://github.com/nodejs/node';

  private async _getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
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
        await this.http.getJsonUnchecked<NodeRelease[]>(
          joinUrlParts(registryUrl, 'index.json'),
        )
      ).body;
      result.releases.push(
        ...resp.map(({ version, date, lts }) => ({
          version,
          releaseTimestamp: asTimestamp(date),
          isStable: lts !== false,
        })),
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${datasource}`,
        // TODO: types (#22198)
        key: `${config.registryUrl}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}

import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { id as versioning } from '../../versioning/node/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { datasource, defaultRegistryUrl } from './common.ts';
import { NodeReleases } from './schema.ts';

export class NodeVersionDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return [defaultRegistryUrl];
  }

  override readonly defaultVersioning = versioning;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `date` field.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'We use the URL: https://github.com/nodejs/node';

  private async fetchReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next -- should never happen */
    if (!registryUrl) {
      return null;
    }
    const result: ReleaseResult = {
      homepage: 'https://nodejs.org',
      sourceUrl: 'https://github.com/nodejs/node',
      registryUrl,
      releases: [],
    };
    const body = await this.fetchJson(
      joinUrlParts(registryUrl, 'index.json'),
      NodeReleases,
    );
    result.releases.push(
      ...body.map(({ version, date, lts }) => ({
        version,
        releaseTimestamp: asTimestamp(date),
        isStable: lts !== false,
      })),
    );

    return result.releases.length ? result : null;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: buildCacheKey(config.registryUrl),
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }
}

import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { id as versioning } from '../../versioning/node/index.ts';
import { Datasource } from '../datasource.ts';
import type { RegistryGetReleasesConfig, ReleaseResult } from '../types.ts';
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
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const result: ReleaseResult = {
      homepage: 'https://nodejs.org',
      sourceUrl: 'https://github.com/nodejs/node',
      registryUrl,
      releases: [],
    };
    try {
      const resp = await this.http.getJson(
        joinUrlParts(registryUrl, 'index.json'),
        NodeReleases,
      );
      result.releases.push(
        ...resp.body.map(({ version, date, lts }) => ({
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

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: `${config.registryUrl}`,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }
}

import { logger } from '../../../logger/index.ts';
import type { NonEmptyArray } from '../../../types/index.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { RegistryDatasource } from '../datasource.ts';
import type { RegistryGetReleasesConfig, ReleaseResult } from '../types.ts';
import { datasource, registryUrl } from './common.ts';
import { EndoflifeDateVersions } from './schema.ts';

export class EndoflifeDateDatasource extends RegistryDatasource {
  static readonly id = datasource;

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return [registryUrl];
  }
  override readonly defaultVersioning = 'loose';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `releaseDate` field in the results.';

  constructor() {
    super(EndoflifeDateDatasource.id);
  }

  private async fetchReleases({
    registryUrl,
    packageName,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace(`${datasource}.getReleases(${registryUrl}, ${packageName})`);

    const result: ReleaseResult = {
      releases: [],
    };

    const url = joinUrlParts(registryUrl, `${packageName}.json`);

    const body = await this.fetchJson(url, EndoflifeDateVersions);

    result.releases.push(...body);

    return result.releases.length ? result : null;
  }

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: `${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }
}

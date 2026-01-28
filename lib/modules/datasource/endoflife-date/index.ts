import { isNonEmptyString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { datasource, registryUrl } from './common.ts';
import { EndoflifeDateVersions } from './schema.ts';

export class EndoflifeDateDatasource extends Datasource {
  static readonly id = datasource;

  override readonly defaultRegistryUrls = [registryUrl];
  override readonly caching = true;
  override readonly defaultVersioning = 'loose';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `releaseDate` field in the results.';

  constructor() {
    super(EndoflifeDateDatasource.id);
  }

  private async _getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!isNonEmptyString(registryUrl)) {
      return null;
    }

    logger.trace(`${datasource}.getReleases(${registryUrl}, ${packageName})`);

    const result: ReleaseResult = {
      releases: [],
    };

    const url = joinUrlParts(registryUrl, `${packageName}.json`);

    try {
      const response = await this.http.getJson(url, EndoflifeDateVersions);

      result.releases.push(...response.body);

      return result.releases.length ? result : null;
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${datasource}`,
        // TODO: types (#22198)
        key: `${config.registryUrl!}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}

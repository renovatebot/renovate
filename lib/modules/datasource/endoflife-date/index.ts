import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource, registryUrl } from './common';
import { EndoflifeDateVersions } from './schema';

export class EndoflifeDatePackagesource extends Datasource {
  static readonly id = datasource;

  override readonly defaultRegistryUrls = [registryUrl];
  override readonly caching = true;
  override readonly defaultVersioning = 'loose';

  constructor() {
    super(EndoflifeDatePackagesource.id);
  }

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#7154)
      `${registryUrl!}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!is.nonEmptyString(registryUrl)) {
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
}

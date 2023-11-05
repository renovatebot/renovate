import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpResponse } from '../../../util/http/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { CarthageJSON } from './types';

export class CarthageDatasource extends Datasource {
  static readonly id = 'carthage';

  constructor() {
    super(CarthageDatasource.id);
  }

  override readonly customRegistrySupport = true;

  @cache({
    namespace: `datasource-${CarthageDatasource.id}`,
    key: ({ packageName, registryUrl }: GetReleasesConfig) =>
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    let response: HttpResponse<CarthageJSON>;
    try {
      response = await this.http.getJson<CarthageJSON>(registryUrl);
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const carthageReleases: CarthageJSON = response.body;

    // istanbul ignore if
    if (!carthageReleases) {
      logger.warn(
        { datasource: 'carthage', packageName },
        `Invalid response body`
      );
      return null;
    }

    const releases = Object.keys(carthageReleases);
    if (releases.length === 0) {
      logger.debug(`No versions found for ${packageName} (${registryUrl})`);
      return null;
    }

    const result: ReleaseResult = {
      registryUrl,
      releases: releases.map((version) => ({
        version,
      })),
    };

    return result;
  }
}

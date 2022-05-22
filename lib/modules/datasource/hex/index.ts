import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpResponse } from '../../../util/http/types';
import * as hexVersioning from '../../versioning/hex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { HexRelease } from './types';

export class HexDatasource extends Datasource {
  static readonly id = 'hex';

  constructor() {
    super(HexDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://hex.pm/'];

  override readonly customRegistrySupport = false;

  override readonly defaultVersioning = hexVersioning.id;

  @cache({
    namespace: `datasource-${HexDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    // Get dependency name from packageName.
    // If the dependency is private packageName contains organization name as following:
    // hexPackageName:organizationName
    // hexPackageName is used to pass it in hex dep url
    // organizationName is used for accessing to private deps
    const [hexPackageName, organizationName] = packageName.split(':');
    const organizationUrlPrefix = organizationName
      ? `repos/${organizationName}/`
      : '';
    const hexUrl = `${registryUrl}api/${organizationUrlPrefix}packages/${hexPackageName}`;

    let response: HttpResponse<HexRelease>;
    try {
      response = await this.http.getJson<HexRelease>(hexUrl);
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const hexRelease: HexRelease = response.body;

    if (!hexRelease) {
      logger.warn({ datasource: 'hex', packageName }, `Invalid response body`);
      return null;
    }

    const { releases = [], html_url: homepage, meta } = hexRelease;

    if (releases.length === 0) {
      logger.debug(`No versions found for ${hexPackageName} (${hexUrl})`); // prettier-ignore
      return null;
    }

    const result: ReleaseResult = {
      releases: releases.map(({ version, inserted_at }) =>
        inserted_at
          ? {
              version,
              releaseTimestamp: inserted_at,
            }
          : { version }
      ),
    };

    if (homepage) {
      result.homepage = homepage;
    }

    if (meta?.links?.Github) {
      result.sourceUrl = meta?.links?.Github;
    }

    return result;
  }
}

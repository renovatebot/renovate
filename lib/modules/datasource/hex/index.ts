import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { joinUrlParts } from '../../../util/url';
import * as hexVersioning from '../../versioning/hex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { HexRelease } from './schema';

export class HexDatasource extends Datasource {
  static readonly id = 'hex';

  constructor() {
    super(HexDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://hex.pm'];

  override readonly defaultVersioning = hexVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined the `inserted_at` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `Github` field in the results.';

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

    const hexUrl = joinUrlParts(
      registryUrl,
      `/api/${organizationUrlPrefix}packages/${hexPackageName}`,
    );

    const { val: result, err } = await this.http
      .getJsonSafe(hexUrl, HexRelease)
      .onError((err) => {
        logger.warn(
          { url: hexUrl, datasource: 'hex', packageName, err },
          'Error fetching from url',
        );
      })
      .unwrap();

    if (err) {
      this.handleGenericErrors(err);
    }

    return result;
  }
}

import { ZodError } from 'zod/v3';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { JuliaPackageMetadata } from './schema.ts';

export class JuliaGeneralMetadataDatasource extends Datasource {
  static readonly id = 'julia-general-metadata';

  constructor() {
    super(JuliaGeneralMetadataDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [
    'https://juliaregistries.github.io/GeneralMetadata.jl/',
  ];

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `registered` field in the results.';

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore if -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const url = joinUrlParts(registryUrl, 'api', packageName, 'versions.json');

    const { val: result, err } = await this.http
      .getJsonSafe(url, JuliaPackageMetadata)
      .unwrap();

    if (err instanceof ZodError) {
      logger.debug(
        {
          err,
          url,
          datasource: JuliaGeneralMetadataDatasource.id,
          packageName,
        },
        'Failed to parse Julia package versions',
      );
      return null;
    }

    if (err) {
      logger.debug(
        {
          err,
          url,
          datasource: JuliaGeneralMetadataDatasource.id,
          packageName,
        },
        'Error fetching Julia package versions',
      );
      this.handleGenericErrors(err);
    }

    return result;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${JuliaGeneralMetadataDatasource.id}`,
        key: config.packageName,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}

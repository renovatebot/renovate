import { buildCacheKey } from '../../../util/cache/package/key.ts';
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

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return ['https://juliaregistries.github.io/GeneralMetadata.jl/'];
  }

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

    return this.fetchJsonOrNull(url, JuliaPackageMetadata);
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${JuliaGeneralMetadataDatasource.id}`,
        key: buildCacheKey('getReleases', config.packageName),
        fallback: true,
        cacheable: true,
      },
      () => this._getReleases(config),
    );
  }
}

import { logger } from '../../../logger/index.ts';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { joinUrlParts } from '../../../util/url.ts';
import * as juliaVersioning from '../../versioning/julia/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { JuliaPackageInfo, JuliaPackageMetadata } from './schema.ts';

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

  override readonly defaultVersioning = juliaVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `registered` field in the results.';

  private getVersions(
    registryUrl: string,
    name: string,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${JuliaGeneralMetadataDatasource.id}`,
        key: buildCacheKey('getVersions', name),
        public: true,
        fallback: true,
      },
      () =>
        this.fetchJsonOrNull(
          joinUrlParts(registryUrl, 'api', name, 'versions.json'),
          JuliaPackageMetadata,
        ),
    );
  }

  private getUuid(
    registryUrl: string,
    name: string,
  ): Promise<string | undefined> {
    return withCache(
      {
        namespace: `datasource-${JuliaGeneralMetadataDatasource.id}`,
        key: buildCacheKey('getUuid', name),
        public: true,
        fallback: true,
      },
      async () => {
        const info = await this.fetchJsonOrNull(
          joinUrlParts(registryUrl, 'api', name, 'info.json'),
          JuliaPackageInfo,
        );
        return info?.uuid;
      },
    );
  }

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore if -- should never happen */
    if (!registryUrl) {
      return null;
    }

    // `Example=7876af07-990d-54b4-ab0e-23690620f79a` names a package and its
    // UUID, as Pkg's REPL does. A name is unique only within a registry, so a
    // package from another registry can have the name of a General package.
    const [name, uuid] = packageName.split('=');
    const [generalUuid, releases] = await Promise.all([
      uuid ? this.getUuid(registryUrl, name) : undefined,
      this.getVersions(registryUrl, name),
    ]);
    if (uuid && generalUuid?.toLowerCase() !== uuid.toLowerCase()) {
      logger.debug(
        { packageName, generalUuid },
        'Package is not the General package of that name',
      );
      return null;
    }
    return releases;
  }
}

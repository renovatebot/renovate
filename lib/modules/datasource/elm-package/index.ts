import type { NonEmptyArray } from '../../../types/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { joinUrlParts } from '../../../util/url.ts';
import * as elmVersioning from '../../versioning/elm/index.ts';
import { RegistryDatasource } from '../datasource.ts';
import type { RegistryGetReleasesConfig, ReleaseResult } from '../types.ts';
import { ElmPackageReleases } from './schema.ts';

export class ElmPackageDatasource extends RegistryDatasource {
  static readonly id = 'elm-package';

  constructor() {
    super(ElmPackageDatasource.id);
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return ['https://package.elm-lang.org'];
  }

  override readonly defaultVersioning = elmVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the Unix timestamp in the results.';

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the package name using the GitHub pattern.';

  async _getReleases({
    packageName,
    registryUrl,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const baseUrl = registryUrl;
    const pkgUrl = joinUrlParts(
      baseUrl,
      'packages',
      packageName,
      'releases.json',
    );

    const result = await this.fetchJsonOrNull(pkgUrl, ElmPackageReleases);
    if (!result) {
      return null;
    }

    // Elm packages must be published from GitHub - the package name IS the GitHub repo path
    // (e.g., "elm/core" is published from github.com/elm/core)
    // This is enforced by the `elm publish` command
    if (packageName.includes('/')) {
      result.sourceUrl = `https://github.com/${packageName}`;
    }

    return result;
  }

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${ElmPackageDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}`,
        fallback: true,
        cacheable: true,
      },
      () => this._getReleases(config),
    );
  }
}

import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { regEx } from '../../../util/regex.ts';
import { Datasource } from '../datasource.ts';
import { defaultRegistryUrl } from '../npm/common.ts';
import { NpmDatasource } from '../npm/index.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import { UnpkgDigestResponse } from './schema.ts';

function splitPackageAndAsset(packageName: string): {
  library: string;
  asset: string;
} {
  const parts = packageName.split('/');
  const library = packageName.startsWith('@')
    ? parts.slice(0, 2).join('/')
    : parts[0];
  const asset = packageName.slice(library.length + 1);
  return { library, asset };
}

export class UnpkgDatasource extends Datasource {
  static readonly id = 'unpkg';

  private readonly npmDatasource: NpmDatasource;

  constructor() {
    super(UnpkgDatasource.id);

    this.npmDatasource = new NpmDatasource();
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return ['https://unpkg.com/'];
  }

  private async getNpmReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return await this.npmDatasource.getReleases({
      registryUrl: defaultRegistryUrl,
      packageName: config.packageName,
    });
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.getNpmReleases(config);
  }

  private async _getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const { packageName, registryUrl } = config;
    if (!newValue || !registryUrl) {
      return null;
    }

    const { library, asset } = splitPackageAndAsset(packageName);

    const url = `${registryUrl}${library}@${newValue}?meta`;
    const val = await this.fetchJsonOrNull(url, UnpkgDigestResponse);

    const file = val?.files.find(
      (file) => file.path.replace(regEx(/^\/+/), '') === asset,
    );

    return file?.integrity ?? null;
  }

  override getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    return this.cached(
      {
        key: buildCacheKey(
          'getDigest',
          config.registryUrl,
          config.packageName,
          newValue,
        ),
        public: true,
        fallback: true,
      },
      () => this._getDigest(config, newValue),
    );
  }
}

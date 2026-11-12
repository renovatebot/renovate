import { ZodError } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { regEx } from '../../../util/regex.ts';
import { Result } from '../../../util/result.ts';
import { Datasource } from '../datasource.ts';
import { defaultRegistryUrl } from '../npm/common.ts';
import { NpmDatasource } from '../npm/index.ts';
import { DigestsConfig } from '../schema.ts';
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

  override readonly customRegistrySupport = false;
  override readonly defaultRegistryUrls = ['https://unpkg.com/'];

  async getNpmReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return await this.npmDatasource.getReleases({
      registryUrl: defaultRegistryUrl,
      packageName: config.packageName,
    });
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${UnpkgDatasource.id}`,
        key: `getReleases:${config.packageName}`,
        fallback: true,
      },
      () => this.getNpmReleases(config),
    );
  }

  private async _getDigest(
    config: DigestConfig,
    newValue: string,
  ): Promise<string | null> {
    const { packageName } = config;
    const { library, asset } = splitPackageAndAsset(packageName);

    const result = Result.parse(config, DigestsConfig).transform(
      ({ registryUrl }) => {
        const url = `${registryUrl}${library}@${newValue}?meta`;
        return this.http.getJsonSafe(url, UnpkgDigestResponse);
      },
    );

    const { val = null, err } = await result.unwrap();
    if (err instanceof ZodError) {
      logger.debug({ err }, 'unpkg: validation error');
      return null;
    }
    if (err) {
      this.handleGenericErrors(err);
    }

    const file = val?.files.find(
      (file) => file.path.replace(regEx(/^\/+/), '') === asset,
    );

    return file?.integrity ? `${file.integrity}` : null;
  }

  override getDigest(
    config: DigestConfig,
    newValue: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: `datasource-${UnpkgDatasource.id}`,
        key: `getDigest:${config.registryUrl}:${config.packageName}:${newValue}`,
        fallback: true,
      },
      () => this._getDigest(config, newValue),
    );
  }
}

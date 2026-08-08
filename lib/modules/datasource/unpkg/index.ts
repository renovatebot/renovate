import { ZodError } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider.ts';
import type { HttpError } from '../../../util/http/index.ts';
import { Result } from '../../../util/result.ts';
import { Datasource } from '../datasource.ts';
import { DigestsConfig, ReleasesConfig } from '../schema.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';

import { UnpkgDigestResponse, UnpkgPackageResponse } from './schema.ts';

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

  constructor() {
    super(UnpkgDatasource.id);
  }

  override readonly customRegistrySupport = false;
  override readonly defaultRegistryUrls = ['https://unpkg.com/'];

  private async _getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const result = Result.parse(config, ReleasesConfig)
      .transform(({ packageName, registryUrl }) => {
        const url = `${registryUrl}${packageName}@latest?meta`;
        return this.http.getJsonSafe(
          url,
          { cacheProvider: memCacheProvider },
          UnpkgPackageResponse,
        );
      })
      .transform(({ version }): ReleaseResult => {
        const res: ReleaseResult = {
          releases: [{ version }],
        };
        return res;
      });

    const { val, err } = await result.unwrap();
    if (err instanceof ZodError) {
      logger.debug({ err }, 'unpkg: validation error');
      return null;
    }
    if (err) {
      this.handleGenericErrors(err);
    }
    return val;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${UnpkgDatasource.id}`,
        key: `getReleases:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
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
      (file) => file.path.replace(/^\/+/, '') === asset,
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

  override handleHttpErrors(err: HttpError): void {
    if (err.response?.statusCode !== 404) {
      throw new ExternalHostError(err);
    }
  }
}

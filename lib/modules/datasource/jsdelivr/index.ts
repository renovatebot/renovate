import { ZodError } from 'zod/v4';

import { logger } from '../../../logger/index.ts';

import { withCache } from '../../../util/cache/package/with-cache.ts';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider.ts';
import { Result } from '../../../util/result.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';

import { Datasource } from '../datasource.ts';
import { DigestsConfig, ReleasesConfig } from '../schema.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';

import { parseJsDelivrPackageName } from './common.ts';
import { JsDelivrDigestResponse, JsDelivrPackageResponse } from './schema.ts';

export class JsDelivrDatasource extends Datasource {
  static readonly id = 'jsdelivr';

  constructor() {
    super(JsDelivrDatasource.id);
  }

  override readonly customRegistrySupport = false;
  override readonly defaultRegistryUrls = ['https://data.jsdelivr.com/v1/'];

  private async _getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const result = Result.parse(config, ReleasesConfig)
      .transform(({ packageName, registryUrl }) => {
        const { type, package: parsedPackageName } =
          parseJsDelivrPackageName(packageName);
        const url = `${ensureTrailingSlash(registryUrl)}packages/${type}/${parsedPackageName}`;
        return this.http.getJsonSafe(
          url,
          { cacheProvider: memCacheProvider },
          JsDelivrPackageResponse,
        );
      })
      .transform(({ versions, tags }): ReleaseResult => {
        const res: ReleaseResult = {
          releases: versions,
          tags: tags,
        };
        return res;
      });

    const { val, err } = await result.unwrap();
    if (err instanceof ZodError) {
      logger.debug({ err }, 'jsdelivr: validation error');
      return null;
    }
    if (err) {
      this.handleGenericErrors(err);
    }
    return val;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { type, package: parsedPackageName } = parseJsDelivrPackageName(
      config.packageName,
    );
    return withCache(
      {
        namespace: `datasource-${JsDelivrDatasource.id}`,
        key: `getReleases:${type}:${parsedPackageName}`,
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
    const {
      type,
      package: parsedPackageName,
      asset,
    } = parseJsDelivrPackageName(packageName);

    const result = Result.parse(config, DigestsConfig).transform(
      ({ registryUrl }) => {
        const url = `${ensureTrailingSlash(registryUrl)}packages/${type}/${parsedPackageName}@${newValue}?structure=flat`;
        return this.http.getJsonSafe(url, JsDelivrDigestResponse);
      },
    );

    const { val, err } = await result.unwrap();
    if (err instanceof ZodError) {
      logger.debug({ err }, 'jsdelivr: validation error');
      return null;
    }
    if (err) {
      this.handleGenericErrors(err);
    }

    const file = val?.files.find(
      (file) => file.name.replace(/^\/+/, '') === asset,
    );
    return file ? `sha256-${file.hash}` : null;
  }

  override getDigest(
    config: DigestConfig,
    newValue: string,
  ): Promise<string | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!newValue) {
      return Promise.resolve(null);
    }
    return withCache(
      {
        namespace: `datasource-${JsDelivrDatasource.id}`,
        key: `getDigest:${config.registryUrl}:${config.packageName}:${newValue}`,
        fallback: true,
      },
      () => this._getDigest(config, newValue),
    );
  }
}

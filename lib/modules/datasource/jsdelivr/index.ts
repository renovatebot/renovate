import { ZodError } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider.ts';
import { regEx } from '../../../util/regex.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import { defaultRegistryUrl } from '../npm/common.ts';
import { NpmDatasource } from '../npm/index.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';

import { parseJsDelivrPackageName } from './common.ts';
import { JsDelivrDigestResponse, JsDelivrPackageResponse } from './schema.ts';

export class JsDelivrDatasource extends Datasource {
  static readonly id = 'jsdelivr';

  private readonly npmDatasource: NpmDatasource;

  constructor() {
    super(JsDelivrDatasource.id);

    this.npmDatasource = new NpmDatasource();
  }

  override readonly customRegistrySupport = false;
  override readonly defaultRegistryUrls = ['https://data.jsdelivr.com/v1/'];

  private async getNpmReleases(
    packageName: string,
  ): Promise<ReleaseResult | null> {
    return await this.npmDatasource.getReleases({
      registryUrl: defaultRegistryUrl,
      packageName,
    });
  }

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null | undefined> {
    if (!registryUrl) {
      return undefined;
    }

    const { type, package: parsedPackageName } =
      parseJsDelivrPackageName(packageName);
    const url = `${ensureTrailingSlash(registryUrl)}packages/${type}/${parsedPackageName}`;

    try {
      const { body } = await this.http.getJson(
        url,
        { cacheProvider: memCacheProvider },
        JsDelivrPackageResponse,
      );
      return {
        releases: body.versions,
        tags: body.tags,
      };
    } catch (err) {
      if (err instanceof ZodError) {
        logger.debug({ err }, 'jsdelivr: validation error');
        return undefined;
      }

      this.handleGenericErrors(err);
    }
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { type, package: parsedPackageName } = parseJsDelivrPackageName(
      config.packageName,
    );

    if (type === 'npm') {
      return withCache(
        {
          namespace: `datasource-${JsDelivrDatasource.id}`,
          key: `getReleases:${type}:${parsedPackageName}`,
          fallback: true,
        },
        () => this.getNpmReleases(parsedPackageName),
      );
    }

    return withCache(
      {
        namespace: `datasource-${JsDelivrDatasource.id}`,
        key: `getReleases:${type}:${parsedPackageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    ).then((result) => result ?? null);
  }

  private async _getDigest(
    config: DigestConfig,
    newValue: string,
  ): Promise<string | null | undefined> {
    const { packageName, registryUrl } = config;

    if (!registryUrl) {
      return undefined;
    }

    const {
      type,
      package: parsedPackageName,
      asset,
    } = parseJsDelivrPackageName(packageName);
    const url = `${ensureTrailingSlash(registryUrl)}packages/${type}/${parsedPackageName}@${newValue}?structure=flat`;

    try {
      const { body } = await this.http.getJson(url, JsDelivrDigestResponse);
      const file = body.files.find(
        (file) => file.name.replace(regEx(/^\/+/), '') === asset,
      );
      return file ? `sha256-${file.hash}` : null;
    } catch (err) {
      if (err instanceof ZodError) {
        logger.debug({ err }, 'jsdelivr: validation error');
        return undefined;
      }

      this.handleGenericErrors(err);
    }
  }

  override getDigest(
    config: DigestConfig,
    newValue: string,
  ): Promise<string | null> {
    /* v8 ignore next -- should never happen */
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
    ).then((result) => result ?? null);
  }
}

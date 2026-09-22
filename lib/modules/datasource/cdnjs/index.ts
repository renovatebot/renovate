import { ZodError } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider.ts';
import type { HttpError } from '../../../util/http/index.ts';
import { Datasource } from '../datasource.ts';
import type {
  RegistryDigestConfig,
  RegistryGetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import { CdnjsAPISriResponse, CdnjsAPIVersionResponse } from './schema.ts';

export class CdnjsDatasource extends Datasource {
  static readonly id = 'cdnjs';

  constructor() {
    super(CdnjsDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://api.cdnjs.com/'];

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `repository` field in the results.';

  private async _getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const { packageName, registryUrl } = config;
    const [library] = packageName.split('/');

    const url = `${registryUrl}libraries/${library}?fields=homepage,repository,versions`;

    const result = this.http
      .getJsonSafe(
        url,
        { cacheProvider: memCacheProvider },
        CdnjsAPIVersionResponse,
      )
      .transform(({ versions, homepage, repository }): ReleaseResult => {
        const releases: Release[] = versions;

        const res: ReleaseResult = { releases };

        if (homepage) {
          res.homepage = homepage;
        }

        if (repository) {
          res.sourceUrl = repository;
        }

        return res;
      });

    const { val, err } = await result.unwrap();

    if (err instanceof ZodError) {
      logger.debug({ err }, 'cdnjs: validation error');
      return null;
    }

    if (err) {
      this.handleGenericErrors(err);
    }

    return val;
  }

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const library = config.packageName.split('/')[0];
    return withCache(
      {
        namespace: `datasource-${CdnjsDatasource.id}`,
        key: `getReleases:${library}`,
        cacheable: true,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  private async _getDigest(
    config: RegistryDigestConfig,
    newValue: string,
  ): Promise<string | null> {
    const { packageName, registryUrl } = config;
    const [library] = packageName.split('/');
    const assetName = packageName.replace(`${library}/`, '');

    const url = `${registryUrl}libraries/${library}/${newValue}?fields=sri`;

    const result = this.http
      .getJsonSafe(url, CdnjsAPISriResponse)
      .transform(({ sri }): string => {
        return sri?.[assetName];
      });

    const { val = null, err } = await result.unwrap();

    if (err instanceof ZodError) {
      logger.debug({ err }, 'cdnjs: validation error');
      return null;
    }

    if (err) {
      this.handleGenericErrors(err);
    }

    return val;
  }

  override getDigest(
    config: RegistryDigestConfig,
    newValue: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: `datasource-${CdnjsDatasource.id}`,
        key: `getDigest:${config.registryUrl}:${config.packageName}:${newValue}`,
        cacheable: true,
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

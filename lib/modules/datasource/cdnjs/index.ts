import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider.ts';
import type { HttpError } from '../../../util/http/index.ts';
import { Datasource } from '../datasource.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import { CdnjsAPISriResponse, CdnjsAPIVersionResponse } from './schema.ts';

export class CdnjsDatasource extends Datasource {
  static readonly id = 'cdnjs';

  constructor() {
    super(CdnjsDatasource.id);
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return ['https://api.cdnjs.com/'];
  }

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `repository` field in the results.';

  private async _getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const { packageName, registryUrl } = config;
    /* v8 ignore next -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const [library] = packageName.split('/');

    const url = `${registryUrl}libraries/${library}?fields=homepage,repository,versions`;

    const body = await this.fetchJsonOrNull(url, CdnjsAPIVersionResponse, {
      cacheProvider: memCacheProvider,
    });
    if (!body) {
      return null;
    }

    const { versions, homepage, repository } = body;
    const releases: Release[] = versions;

    const res: ReleaseResult = { releases };

    if (homepage) {
      res.homepage = homepage;
    }

    if (repository) {
      res.sourceUrl = repository;
    }

    return res;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const library = config.packageName.split('/')[0];
    return withCache(
      {
        namespace: `datasource-${CdnjsDatasource.id}`,
        key: buildCacheKey('getReleases', library),
        cacheable: true,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  private async _getDigest(
    config: DigestConfig,
    newValue: string,
  ): Promise<string | null> {
    const { packageName, registryUrl } = config;
    /* v8 ignore next -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const [library] = packageName.split('/');
    const assetName = packageName.replace(`${library}/`, '');

    const url = `${registryUrl}libraries/${library}/${newValue}?fields=sri`;

    const body = await this.fetchJsonOrNull(url, CdnjsAPISriResponse);

    return body?.sri?.[assetName] ?? null;
  }

  override getDigest(
    config: DigestConfig,
    newValue: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: `datasource-${CdnjsDatasource.id}`,
        key: buildCacheKey(
          'getDigest',
          config.registryUrl,
          config.packageName,
          newValue,
        ),
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

import { ZodError } from 'zod';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpError } from '../../../util/http';
import { Result } from '../../../util/result';
import { Datasource } from '../datasource';
import { DigestsConfig, ReleasesConfig } from '../schema';
import type {
  DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types';
import {
  CdnjsAPISriResponseSchema,
  CdnjsAPIVersionResponseSchema,
} from './schema';

export class CdnJsDatasource extends Datasource {
  static readonly id = 'cdnjs';

  constructor() {
    super(CdnJsDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://api.cdnjs.com/'];

  @cache({
    namespace: `datasource-${CdnJsDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName.split('/')[0],
  })
  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const result = Result.parse(config, ReleasesConfig)
      .transform(({ packageName, registryUrl }) => {
        const [library] = packageName.split('/');

        const url = `${registryUrl}libraries/${library}?fields=homepage,repository,versions`;

        return this.http.getJsonSafe(url, CdnjsAPIVersionResponseSchema);
      })
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

  @cache({
    namespace: `datasource-${CdnJsDatasource.id}-digest`,
    key: ({ registryUrl, packageName }: DigestConfig, newValue: string) =>
      `${registryUrl}:${packageName}:${newValue}}`,
  })
  override async getDigest(
    config: DigestConfig,
    newValue: string,
  ): Promise<string | null> {
    const { packageName } = config;
    const [library] = packageName.split('/');
    const assetName = packageName.replace(`${library}/`, '');

    const result = Result.parse(config, DigestsConfig)
      .transform(({ registryUrl }) => {
        const url = `${registryUrl}libraries/${library}/${newValue}?fields=sri`;

        return this.http.getJsonSafe(url, CdnjsAPISriResponseSchema);
      })
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

  override handleHttpErrors(err: HttpError): void {
    if (err.response?.statusCode !== 404) {
      throw new ExternalHostError(err);
    }
  }
}

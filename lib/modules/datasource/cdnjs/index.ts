import { ZodError, z } from 'zod';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { HttpError } from '../../../util/http';
import { Result } from '../../../util/result';
import { Datasource } from '../datasource';
import { ReleasesConfig } from '../schema';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

const Homepage = z.string().optional().catch(undefined);

const Repository = z
  .object({
    type: z.literal('git'),
    url: z.string(),
  })
  .transform(({ url }) => url)
  .optional()
  .catch(undefined);

const Versions = z.string().array();

export class CdnJsDatasource extends Datasource {
  static readonly id = 'cdnjs';

  constructor() {
    super(CdnJsDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://api.cdnjs.com/'];

  override readonly caching = true;

  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const result = Result.parse(config, ReleasesConfig)
      .transform(({ packageName, registryUrl }) => {
        const [library] = packageName.split('/');

        const url = `${registryUrl}libraries/${library}?fields=homepage,repository,versions`;

        const schema = z.object({
          homepage: Homepage,
          repository: Repository,
          versions: Versions.transform((versions) =>
            versions.map((version) => {
              const res: Release = { version };
              return res;
            }),
          ),
        });

        return this.http.getJsonSafe(url, schema);
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

  override handleHttpErrors(err: HttpError): void {
    if (err.response?.statusCode !== 404) {
      throw new ExternalHostError(err);
    }
  }
}

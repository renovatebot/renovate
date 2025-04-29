import urlJoin from 'url-join';
import { ZodError } from 'zod';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { Result } from '../../../util/result';
import { Datasource } from '../datasource';
import { ReleasesConfig } from '../schema';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { BuildpacksRegistryResponseSchema } from './schema';

export class BuildpacksRegistryDatasource extends Datasource {
  static readonly id = 'buildpacks-registry';

  constructor() {
    super(BuildpacksRegistryDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://registry.buildpacks.io'];

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `published_at` field in the results.';
  override readonly sourceUrlSupport = 'release';
  override readonly sourceUrlNote =
    'The source URL is determined from the `source_code_url` field of the release object in the results.';

  @cache({
    namespace: `datasource-${BuildpacksRegistryDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl}:${packageName}`,
  })
  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const result = Result.parse(config, ReleasesConfig)
      .transform(({ packageName, registryUrl }) => {
        const url = urlJoin(
          registryUrl,
          'api',
          'v1',
          'buildpacks',
          packageName,
        );

        return this.http.getJsonSafe(url, BuildpacksRegistryResponseSchema);
      })
      .transform(({ versions, latest }): ReleaseResult => {
        const releases: Release[] = versions;

        const res: ReleaseResult = { releases };

        if (latest?.homepage) {
          res.homepage = latest.homepage;
        }

        return res;
      });

    const { val, err } = await result.unwrap();

    if (err instanceof ZodError) {
      logger.debug({ err }, 'buildpacks: validation error');
      return null;
    }

    if (err) {
      this.handleGenericErrors(err);
    }

    return val;
  }
}

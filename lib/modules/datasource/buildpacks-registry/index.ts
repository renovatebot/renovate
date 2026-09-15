import urlJoin from 'url-join';
import { ZodError } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { Datasource } from '../datasource.ts';
import type {
  RegistryGetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import { BuildpacksRegistryResponse } from './schema.ts';

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

  private async _getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const { packageName, registryUrl } = config;
    const url = urlJoin(registryUrl, 'api', 'v1', 'buildpacks', packageName);

    const result = this.http
      .getJsonSafe(url, BuildpacksRegistryResponse)
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

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${BuildpacksRegistryDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}

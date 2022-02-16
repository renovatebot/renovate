import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { cache } from '../../util/cache/package/decorator';
import { HttpError } from '../../util/http/types';
import { joinUrlParts } from '../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl } from './common';

export class CondaDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, lookupName }: GetReleasesConfig) =>
      `${registryUrl}:${lookupName}`,
  })
  async getReleases({
    registryUrl,
    lookupName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace({ registryUrl, lookupName }, 'fetching conda package');

    const url = joinUrlParts(registryUrl, lookupName);

    const result: ReleaseResult = {
      releases: [],
    };
    try {
      const response = await this.http.get(url);

      const packageJson = JSON.parse(response.body);

      result.homepage = packageJson['html_url'];
      result.sourceUrl = packageJson['dev_url'];

      packageJson['versions'].forEach((version: string) => {
        const thisRelease: Release = {
          version: version,
        };
        result.releases.push(thisRelease);
      });
    } catch (err) {
      // istanbul ignore else: not testable with nock
      if (err instanceof HttpError) {
        if (err.response?.statusCode !== 404) {
          throw new ExternalHostError(err);
        }
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}

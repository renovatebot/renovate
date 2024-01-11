import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource, registryUrl } from './common';
import { EndoflifeDateAwsLambdaVersions } from './schema';

export class EndoflifeDateAwsLambdaPackagesource extends Datasource {
  static readonly id = datasource;

  override readonly defaultRegistryUrls = [registryUrl];
  override readonly caching = true;
  override readonly defaultVersioning = 'loose';

  constructor() {
    super(EndoflifeDateAwsLambdaPackagesource.id);
  }

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#22198)
      `${registryUrl!}:aws-lambda:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!is.nonEmptyString(registryUrl)) {
      return null;
    }

    logger.trace(`${datasource}.getReleases(${registryUrl}, 'aws-lambda')`);

    const result: ReleaseResult = {
      releases: [],
    };

    const url = joinUrlParts(registryUrl, `aws-lambda.json`);

    try {
      const response = await this.http.getJson(url, EndoflifeDateAwsLambdaVersions);

      // filter results by packagename

      result.releases.push(...response.body);

      result.releases = result.releases.filter((release) => release.version.includes(packageName));
      result.releases = result.releases.map((release) => {
        release.version = release.version.replace(packageName,'')
        return release
      });

      return result.releases.length ? result : null;
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }
}

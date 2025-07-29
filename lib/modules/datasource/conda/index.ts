import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { coerceArray } from '../../../util/array';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { Timestamp } from '../../../util/timestamp';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl } from './common';
import * as prefixDev from './prefix-dev';
import type { CondaPackage } from './types';

export class CondaDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'hunt';

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `dev_url` field in the results.';

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#22198)
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace({ registryUrl, packageName }, 'fetching conda package');

    if (!registryUrl) {
      return null;
    }

    // fast.prefix.dev is a alias, deprecated, but still running.
    // We expect registryUrl to be `https://prefix.dev/${channel}` here.
    if (
      registryUrl.startsWith('https://prefix.dev/') ||
      registryUrl.startsWith('https://fast.prefix.dev/')
    ) {
      // Since the registryUrl contains at least 3 `/` ,
      // the channel varitable won't be undefined in any case.
      const channel = ensureTrailingSlash(registryUrl).split('/').at(-2)!;

      return prefixDev.getReleases(this.http, channel, packageName);
    }

    const url = joinUrlParts(registryUrl, packageName);

    const result: ReleaseResult = {
      releases: [],
    };

    let response: { body: CondaPackage };

    try {
      response = await this.http.getJsonUnchecked(url);

      result.homepage = response.body.html_url;
      result.sourceUrl = response.body.dev_url;

      const releaseDate: Record<string, Timestamp> = {};
      // we assume all packages are roughly released on the same time
      for (const file of coerceArray(response.body.files)) {
        releaseDate[file.version] ??= Timestamp.parse(file.upload_time);
      }

      response.body.versions.forEach((version: string) => {
        const thisRelease: Release = {
          version,
          releaseTimestamp: releaseDate[version],
        };
        result.releases.push(thisRelease);
      });
    } catch (err) {
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

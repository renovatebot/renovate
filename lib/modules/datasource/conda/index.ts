import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import type { NonEmptyArray } from '../../../types/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { HttpError } from '../../../util/http/index.ts';
import { Timestamp } from '../../../util/timestamp.ts';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url.ts';
import { RegistryDatasource } from '../datasource.ts';
import type {
  RegistryGetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import { datasource, defaultRegistryUrl } from './common.ts';
import * as prefixDev from './prefix-dev.ts';
import { CondaPackage } from './schema.ts';

export class CondaDatasource extends RegistryDatasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return true;
  }

  override readonly registryStrategy = 'hunt';

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return [defaultRegistryUrl];
  }

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `upload_time` field of the files of a version when using the Anaconda.org API, or from the `createdAt` field of the variants of a version when using prefix.dev. All files of a version are assumed to be published at roughly the same time.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `dev_url` field in the results.';

  private async fetchReleases({
    registryUrl,
    packageName,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace({ registryUrl, packageName }, 'fetching conda package');

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

    try {
      const response = await this.http.getJson(url, CondaPackage);

      result.homepage = response.body.html_url;
      result.sourceUrl = response.body.dev_url;

      const releaseDate: Record<string, Timestamp> = {};
      // we assume all packages are roughly released on the same time
      for (const file of coerceArray(response.body.files)) {
        releaseDate[file.version] ??= Timestamp.parse(file.upload_time);
      }

      coerceArray(response.body.versions).forEach((version: string) => {
        const thisRelease: Release = {
          version,
          releaseTimestamp: releaseDate[version],
        };
        result.releases.push(thisRelease);
      });
    } catch (err) {
      if (err instanceof HttpError && err.response?.statusCode !== 404) {
        throw new ExternalHostError(err);
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: `${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }
}

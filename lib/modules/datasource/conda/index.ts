import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { coerceArray } from '../../../util/array.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { HttpError } from '../../../util/http/index.ts';
import { Timestamp } from '../../../util/timestamp.ts';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import {
  datasource,
  defaultRegistryUrl,
  isAnacondaApiUrl,
  isPrefixDevUrl,
} from './common.ts';
import * as prefixDev from './prefix-dev.ts';
import * as repodata from './repodata.ts';
import { CondaPackage } from './schema.ts';

export class CondaDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'hunt';

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `upload_time` field of the files of a version when using the Anaconda.org API, from the `createdAt` field of the variants of a version when using prefix.dev, or from the earliest `timestamp` field among the builds of a version when reading a standard conda channel index. Some older builds in channel indexes carry no `timestamp`.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `dev_url` field in the results. A standard conda channel index carries no source URL, so none is reported when reading one.';

  private async _getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace({ registryUrl, packageName }, 'fetching conda package');

    if (!registryUrl) {
      return null;
    }

    // We expect registryUrl to be `https://prefix.dev/${channel}` here.
    if (isPrefixDevUrl(registryUrl)) {
      // Since the registryUrl contains at least 3 `/` ,
      // the channel varitable won't be undefined in any case.
      const channel = ensureTrailingSlash(registryUrl).split('/').at(-2)!;

      return prefixDev.getReleases(this.http, channel, packageName);
    }

    // Only the Anaconda.org REST API exposes a per-package JSON document.
    // Any other registry is treated as a standard conda channel serving a
    // per-platform `repodata.json` index (e.g. self-hosted or Artifactory).
    if (!isAnacondaApiUrl(registryUrl)) {
      try {
        return await repodata.getReleases(this.http, registryUrl, packageName);
      } catch (err) {
        // a channel is only one of several subdirs Renovate hunts through, so
        // only genuine host errors may abort the lookup
        this.handleGenericErrors(err);
      }
    }

    const result: ReleaseResult = {
      releases: [],
    };

    try {
      const url = joinUrlParts(registryUrl, packageName);
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

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { registryUrl } = config;
    return withCache(
      {
        namespace: `datasource-${datasource}`,
        // TODO: types (#22198)
        key: `${registryUrl}:${config.packageName}`,
        // standard conda channels are typically self-hosted and access
        // controlled, so their contents must not reach the shared cache.
        // This gates on the host alone, so a private Anaconda.org org or
        // prefix.dev channel is still cached - that predates this backend and
        // wants `isPrivate` on all three paths rather than a host check.
        cacheable:
          !registryUrl ||
          isAnacondaApiUrl(registryUrl) ||
          isPrefixDevUrl(registryUrl),
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}

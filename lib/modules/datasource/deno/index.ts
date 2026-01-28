import { isNullOrUndefined } from '@sindresorhus/is';
import pMap from 'p-map';
import { logger } from '../../../logger/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { regEx } from '../../../util/regex.ts';
import { joinUrlParts } from '../../../util/url.ts';
import * as semanticVersioning from '../../versioning/semver/index.ts';
import { Datasource } from '../datasource.ts';
import type { Release } from '../index.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import {
  DenoAPIModuleResponse,
  DenoAPIModuleVersionResponse,
} from './schema.ts';

export class DenoDatasource extends Datasource {
  static readonly id = 'deno';

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = semanticVersioning.id;

  override readonly defaultRegistryUrls = ['https://apiland.deno.dev'];

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `uploaded_at` field in the results.';
  override readonly sourceUrlSupport = 'release';
  override readonly sourceUrlNote =
    'The source URL is determined from the `repository` field in the results.';

  constructor() {
    super(DenoDatasource.id);
  }

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const massagedRegistryUrl = registryUrl!;

    const extractResult = regEx(
      /^(https:\/\/deno.land\/)(?<rawPackageName>[^@\s]+)/,
    ).exec(packageName);
    const rawPackageName = extractResult?.groups?.rawPackageName;
    if (isNullOrUndefined(rawPackageName)) {
      logger.debug(
        `Could not extract rawPackageName from packageName: "${packageName}"`,
      );
      return null;
    }

    // remove third-party prefix if defined. The only internal library is `std` and is available under the same API
    const massagedPackageName = rawPackageName.replace('x/', '');

    // https://apiland.deno.dev/v2/modules/postgres
    const moduleAPIURL = joinUrlParts(
      massagedRegistryUrl,
      'v2/modules',
      massagedPackageName,
    );

    return await this.getReleaseResult(moduleAPIURL);
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${DenoDatasource.id}`,
        // TODO: types (#22198)
        key: `getReleases:${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  private async _getReleaseResult(
    moduleAPIURL: string,
  ): Promise<ReleaseResult> {
    const detailsCacheKey = `details:${moduleAPIURL}`;
    const releasesCache: Record<string, Release> =
      (await packageCache.get(
        `datasource-${DenoDatasource.id}`,
        detailsCacheKey,
      )) ?? {};
    let cacheModified = false;

    const {
      body: { versions, tags },
    } = await this.http.getJson(moduleAPIURL, DenoAPIModuleResponse);

    // get details for the versions
    const releases = await pMap(
      versions,
      async (version) => {
        const cacheRelease = releasesCache[version];
        /* v8 ignore next 3: hard to test */
        if (cacheRelease) {
          return cacheRelease;
        }

        // https://apiland.deno.dev/v2/modules/postgres/v0.17.0
        const url = joinUrlParts(moduleAPIURL, version);
        const { body: release } = await this.http.getJson(
          url,
          DenoAPIModuleVersionResponse.catch(({ error: err }) => {
            logger.warn(
              { err, version },
              'Deno: failed to get version details',
            );
            return { version };
          }),
        );

        releasesCache[release.version] = release;
        cacheModified = true;

        return release;
      },
      { concurrency: 5 },
    );

    if (cacheModified) {
      // 1 week. Releases at Deno are immutable, therefore we can use a long term cache here.
      await packageCache.set(
        `datasource-${DenoDatasource.id}`,
        detailsCacheKey,
        releasesCache,
        10080,
      );
    }

    return { releases, tags };
  }

  getReleaseResult(moduleAPIURL: string): Promise<ReleaseResult> {
    return withCache(
      {
        namespace: `datasource-${DenoDatasource.id}`,
        key: `getReleaseResult:${moduleAPIURL}`,
      },
      () => this._getReleaseResult(moduleAPIURL),
    );
  }
}

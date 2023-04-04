import is from '@sindresorhus/is';
import pMap from 'p-map';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';
import * as semanticVersioning from '../../versioning/semver';
import { Datasource } from '../datasource';
import type { Release } from '../index';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { DenoAPIModuleResponse, DenoAPIModuleVersionResponse } from './schema';

export class DenoDatasource extends Datasource {
  static readonly id = 'deno';

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = semanticVersioning.id;

  override readonly defaultRegistryUrls = ['https://apiland.deno.dev'];

  constructor() {
    super(DenoDatasource.id);
  }

  @cache({
    namespace: `datasource-${DenoDatasource.id}`,
    key: ({ packageName, registryUrl }: GetReleasesConfig) =>
      // TODO: types (#7154)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const massagedRegistryUrl = registryUrl!;

    const extractResult = regEx(
      /^(https:\/\/deno.land\/)(?<rawPackageName>[^@\s]+)/
    ).exec(packageName);
    const rawPackageName = extractResult?.groups?.rawPackageName;
    if (is.nullOrUndefined(rawPackageName)) {
      logger.debug(
        `Could not extract rawPackageName from packageName: "${packageName}"`
      );
      return null;
    }

    // remove third-party prefix if defined. The only internal library is `std` and is available under the same API
    const massagedPackageName = rawPackageName.replace('x/', '');

    // https://apiland.deno.dev/v2/modules/postgres
    const moduleAPIURL = joinUrlParts(
      massagedRegistryUrl,
      'v2/modules',
      massagedPackageName
    );

    return await this.getReleaseResult(moduleAPIURL);
  }

  @cache({
    namespace: `datasource-${DenoDatasource.id}-versions`,
    key: (moduleAPIURL) => moduleAPIURL,
  })
  async getReleaseResult(moduleAPIURL: string): Promise<ReleaseResult> {
    const cache: Record<string, Release> =
      (await packageCache.get(
        `datasource-${DenoDatasource.id}-details`,
        moduleAPIURL
      )) ?? {};
    let isModified = false;

    const { body } = await this.http.getJson(moduleAPIURL);
    const { versions, tags } = DenoAPIModuleResponse.parse(body);

    // get details for the versions
    const releases = await pMap(
      versions,
      async (version) => {
        const cacheRelease = cache[version];
        // istanbul ignore if
        if (cacheRelease) {
          return cacheRelease;
        }

        // https://apiland.deno.dev/v2/modules/postgres/v0.17.0
        const url = joinUrlParts(moduleAPIURL, version);
        const releaseDetails = await this.getReleaseDetails(url);
        const release: Release = releaseDetails ?? { version };

        cache[release.version] = release;
        isModified = true;

        return release;
      },
      { concurrency: 5 }
    );

    if (isModified) {
      // 1 week. Releases at Deno are immutable, therefore we can use a long term cache here.
      await packageCache.set(
        `datasource-${DenoDatasource.id}-details`,
        moduleAPIURL,
        cache,
        10080
      );
    }

    return { releases, tags };
  }

  async getReleaseDetails(
    moduleAPIVersionURL: string
  ): Promise<Release | null> {
    const { body } = await this.http.getJson(moduleAPIVersionURL);
    const res = DenoAPIModuleVersionResponse.safeParse(body);
    return res.success ? res.data : null;
  }
}

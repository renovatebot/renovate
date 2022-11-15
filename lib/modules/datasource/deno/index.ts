import is from '@sindresorhus/is';
import pMap from 'p-map';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';
import * as semanticVersioning from '../../versioning/semver';
import { Datasource } from '../datasource';
import type { Release } from '../index';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type {
  DenoAPIModuleResponse,
  DenoAPIModuleVersionResponse,
} from './types';
import { createSourceURL, tagsToRecord } from './utils';

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
    const massagedRegistryUrl = registryUrl ?? this.defaultRegistryUrls[0];

    const extractResult = regEx(
      '^(https:\\/\\/deno.land\\/)(?<rawPackageName>[^@\\s]+)'
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
    const { versions, tags } = (
      await this.http.getJson<DenoAPIModuleResponse>(moduleAPIURL)
    ).body;
    // get details for the versions
    const releases = await pMap(
      versions,
      (version) => {
        // https://apiland.deno.dev/v2/modules/postgres/v0.17.0
        return this.getReleaseDetails(joinUrlParts(moduleAPIURL, version));
      },
      { concurrency: 5 }
    );

    return {
      releases,
      tags: tagsToRecord(tags),
    };
  }

  @cache({
    namespace: `datasource-${DenoDatasource.id}-details`,
    key: (moduleAPIVersionURL) => moduleAPIVersionURL,
    ttlMinutes: 10080, // 1 week. Releases at Deno are immutable, therefore we can use a long term cache here.
  })
  async getReleaseDetails(moduleAPIVersionURL: string): Promise<Release> {
    const { version, uploaded_at, upload_options } = (
      await this.http.getJson<DenoAPIModuleVersionResponse>(moduleAPIVersionURL)
    ).body;
    return {
      version,
      gitRef: upload_options.ref,
      releaseTimestamp: uploaded_at,
      sourceUrl: createSourceURL(upload_options),
    };
  }
}

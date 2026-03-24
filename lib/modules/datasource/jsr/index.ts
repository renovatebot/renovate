import { isNull } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { id as semverId } from '../../versioning/semver/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { defaultRegistryUrls } from './common.ts';
import { JsrPackageMetadata } from './schema.ts';
import { extractJsrPackageName } from './util.ts';

export class JsrDatasource extends Datasource {
  static readonly id = 'jsr';

  // custom registry support is not yet supported
  // https://github.com/jsr-io/jsr/issues/203
  override readonly customRegistrySupport = false;

  override readonly registryStrategy = 'first';
  // https://jsr.io/docs/using-packages#semver-resolution
  override readonly defaultVersioning = semverId;

  // use npm compatible registry api url due to returns
  override readonly defaultRegistryUrls = defaultRegistryUrls;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `createdAt` field in the results. For packages without explicit timestamps, defaults to 2025-09-18.';

  constructor() {
    super(JsrDatasource.id);
  }

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const validJsrPackageName = extractJsrPackageName(packageName);
    if (isNull(validJsrPackageName)) {
      logger.debug(`Could not extract packageName: "${packageName}"`);
      return null;
    }
    // construct a package metadata url
    // https://jsr.io/docs/api#package-metadata
    const packageInfoUrl = joinUrlParts(registryUrl, packageName, 'meta.json');

    const result: ReleaseResult = {
      homepage: joinUrlParts(registryUrl, packageName),
      registryUrl,
      releases: [],
    };

    try {
      const { body } = await this.http.getJson(
        packageInfoUrl,
        JsrPackageMetadata,
      );
      result.releases.push(...body);
    } catch (err) {
      logger.warn({ err }, 'JSR: failed to get package details');
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${JsrDatasource.id}`,
        // TODO: types (#22198)
        key: `getReleases:${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}

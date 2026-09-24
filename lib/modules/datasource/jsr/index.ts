import { isNull } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { id as semverId } from '../../versioning/semver/index.ts';
import { Datasource } from '../datasource.ts';
import type { RegistryGetReleasesConfig, ReleaseResult } from '../types.ts';
import { defaultRegistryUrls } from './common.ts';
import { JsrPackageMetadata } from './schema.ts';
import { extractJsrPackageName } from './util.ts';

export class JsrDatasource extends Datasource {
  static readonly id = 'jsr';

  // custom registry support is not yet supported
  // https://github.com/jsr-io/jsr/issues/203
  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  // https://jsr.io/docs/using-packages#semver-resolution
  override readonly defaultVersioning = semverId;

  // use npm compatible registry api url due to returns
  override getDefaultRegistryUrls(_packageName: string): string[] {
    return defaultRegistryUrls;
  }

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `createdAt` field in the results. For packages without explicit timestamps, defaults to 2025-09-18.';

  constructor() {
    super(JsrDatasource.id);
  }

  private async _getReleases({
    packageName,
    registryUrl,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
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

    const body = await this.fetchJson(packageInfoUrl, JsrPackageMetadata);
    result.releases.push(...body);

    return result.releases.length ? result : null;
  }

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${JsrDatasource.id}`,
        key: `getReleases:${config.registryUrl}:${config.packageName}`,
        cacheable: true,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}

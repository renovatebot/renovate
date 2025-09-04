import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { joinUrlParts } from '../../../util/url';
import * as jsrVersioning from '../../versioning/deno';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { defaultRegistryUrls } from './common';
import { JsrPackageMetadata } from './schema';
import { extractJsrPackageName } from './util';

export class JsrDatasource extends Datasource {
  static readonly id = 'jsr';

  // custom registry support is not yet supported
  // https://github.com/jsr-io/jsr/issues/203
  override readonly customRegistrySupport = false;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = jsrVersioning.id;

  // use npm compatible registry api url due to returns
  override readonly defaultRegistryUrls = defaultRegistryUrls;

  override readonly releaseTimestampSupport = false;

  constructor() {
    super(JsrDatasource.id);
  }

  @cache({
    namespace: `datasource-${JsrDatasource.id}`,
    key: ({ packageName, registryUrl }: GetReleasesConfig) =>
      // TODO: types (#22198)
      `getReleases:${registryUrl}:${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const validJsrPackageName = extractJsrPackageName(packageName);
    if (is.null(validJsrPackageName)) {
      logger.debug(`Could not extract packageName: "${packageName}"`);
      return null;
    }
    // construct a package metadata url
    // https://jsr.io/docs/api#package-metadata
    const packageInfoUrl = joinUrlParts(registryUrl, packageName, 'meta.json');

    const result: ReleaseResult = {
      homepage: joinUrlParts('https://jsr.io', packageName),
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
}

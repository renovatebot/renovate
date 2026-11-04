import { isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { HttpError } from '../../../util/http/index.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { id as npmVersioningId } from '../../versioning/npm/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { ApmPackageVersions } from './schema.ts';

/**
 * Looks up APM (Agent Package Manager) packages on a dedicated package
 * registry which implements the APM registry HTTP API, such as a JFrog
 * Artifactory "Agent Packages" repository.
 *
 * There is no public default registry, so a `registryUrl` is required. The
 * `apm` manager fills it in from the `registries:` block of `apm.yml`.
 *
 * https://microsoft.github.io/apm/reference/registry-http-api/
 */
export class ApmDatasource extends Datasource {
  static readonly id = 'apm';

  constructor() {
    super(ApmDatasource.id);
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return true;
  }

  // registry refs are npm-style exact versions or ranges (`1.2.3`, `^1.2.3`)
  override readonly defaultVersioning = npmVersioningId;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `published_at` field in the results.';

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: buildCacheKey(config.registryUrl, config.packageName),
        // the registry is always user-configured, never a shared public one
        cacheable: false,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl) {
      logger.warn(
        { packageName },
        'apm datasource requires a registryUrl. Skipping datasource',
      );
      return null;
    }

    const identity = ApmDatasource.encodeIdentity(packageName);
    if (!identity) {
      logger.debug(
        { packageName },
        'apm: package name is not an owner/repo identity',
      );
      return null;
    }

    const url = joinUrlParts(registryUrl, 'v1/packages', identity, 'versions');

    let releases;
    try {
      releases = await this.fetchJson(url, ApmPackageVersions);
    } catch (err) {
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        logger.debug({ packageName, registryUrl }, 'apm: package not found');
        return null;
      }
      throw err;
    }

    if (!releases.length) {
      return null;
    }

    return { registryUrl, releases };
  }

  /**
   * Renders the `{owner}/{repo}` path segments for a package identity. As the
   * apm client does, the last segment is the repo and everything before it is
   * the owner, percent-encoded into a single segment for non-GitHub origins
   * such as `gitlab.com/acme/web-skills` (`gitlab.com%2Facme/web-skills`).
   */
  static encodeIdentity(packageName: string): string | null {
    const segments = packageName.split('/').filter(isTruthy);
    if (segments.length < 2) {
      return null;
    }
    const repo = segments.pop()!;
    return `${encodeURIComponent(segments.join('/'))}/${encodeURIComponent(repo)}`;
  }
}

import { isNonEmptyString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { GerritHttp } from '../../../util/http/gerrit.ts';
import { regEx } from '../../../util/regex.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import { GerritBranchInfo, GerritTag, GerritTags } from './schema.ts';

export class GerritTagsDatasource extends Datasource {
  static readonly id = 'gerrit-tags';

  override http = new GerritHttp(GerritTagsDatasource.id);

  private static readonly cacheNamespace: PackageCacheNamespace = `datasource-${GerritTagsDatasource.id}`;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `created` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  constructor() {
    super(GerritTagsDatasource.id);
  }

  /**
   * Gerrit only honors HTTP credentials on URLs under `/a/`.
   * Public (anonymous) access must use the path without `/a/`, otherwise
   * Gerrit responds with 401 Unauthorized.
   * @see https://gerrit-review.googlesource.com/Documentation/rest-api.html#authentication
   */
  private static hasCredentials(registryUrl: string): boolean {
    for (const hostType of [GerritTagsDatasource.id, 'gerrit'] as const) {
      const rule = hostRules.find({ hostType, url: registryUrl });
      if (
        isNonEmptyString(rule.token) ||
        isNonEmptyString(rule.username) ||
        isNonEmptyString(rule.password)
      ) {
        return true;
      }
    }
    return false;
  }

  private static getApiUrl(registryUrl: string): string {
    const base = ensureTrailingSlash(registryUrl);
    const prefix = GerritTagsDatasource.hasCredentials(registryUrl) ? 'a/' : '';
    return `${base}${prefix}projects/`;
  }

  private static getCacheKey(
    registryUrl: string,
    repo: string,
    type: string,
  ): string {
    return `${registryUrl}:${repo}:${type}`;
  }

  private static getSourceUrl(
    packageName: string,
    registryUrl: string,
  ): string {
    return `${ensureTrailingSlash(registryUrl)}${packageName}`;
  }

  private static stripTagRef(ref: string): string {
    return ref.replace(regEx(/^refs\/tags\//), '');
  }

  // getReleases fetches list of tags for the repository
  private async _getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl) {
      logger.debug('gerrit-tags: missing registryUrl');
      return null;
    }

    const url = `${GerritTagsDatasource.getApiUrl(registryUrl)}${encodeURIComponent(repo)}/tags/`;
    const { body: tags } = await this.http.getJson(url, GerritTags);

    return {
      sourceUrl: GerritTagsDatasource.getSourceUrl(repo, registryUrl),
      registryUrl,
      releases: tags.map(({ ref, revision, object: tagObject, created }) => {
        const name = GerritTagsDatasource.stripTagRef(ref);
        return {
          version: name,
          gitRef: name,
          newDigest: tagObject ?? revision,
          releaseTimestamp: created ?? undefined,
        };
      }),
    };
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: GerritTagsDatasource.cacheNamespace,
        key: GerritTagsDatasource.getCacheKey(
          config.registryUrl ?? '',
          config.packageName,
          'tags',
        ),
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  // getTagCommit fetches the commit hash for the specified tag
  private async _getTagCommit(
    registryUrl: string,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    const url = `${GerritTagsDatasource.getApiUrl(registryUrl)}${encodeURIComponent(repo)}/tags/${encodeURIComponent(tag)}`;
    const { body } = await this.http.getJson(url, GerritTag);
    return body.object ?? body.revision;
  }

  getTagCommit(
    registryUrl: string,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: GerritTagsDatasource.cacheNamespace,
        key: GerritTagsDatasource.getCacheKey(registryUrl, repo, `tag-${tag}`),
      },
      () => this._getTagCommit(registryUrl, repo, tag),
    );
  }

  // getDigest fetches the latest commit for repository default branch.
  // If newValue is provided, then getTagCommit is called.
  private async _getDigest(
    { packageName: repo, registryUrl }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    if (!registryUrl) {
      logger.debug('gerrit-tags: missing registryUrl');
      return null;
    }

    if (newValue?.length) {
      return this.getTagCommit(registryUrl, repo, newValue);
    }

    const url = `${GerritTagsDatasource.getApiUrl(registryUrl)}${encodeURIComponent(repo)}/branches/HEAD`;
    const { body } = await this.http.getJson(url, GerritBranchInfo);
    return body.revision;
  }

  override getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: GerritTagsDatasource.cacheNamespace,
        key: GerritTagsDatasource.getCacheKey(
          config.registryUrl ?? '',
          config.packageName,
          newValue?.length ? `digest-${newValue}` : 'digest',
        ),
        fallback: true,
      },
      () => this._getDigest(config, newValue),
    );
  }
}

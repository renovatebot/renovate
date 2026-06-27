import { logger } from '../../../logger/index.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
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

  constructor() {
    super(GerritTagsDatasource.id);
  }

  private static getApiUrl(registryUrl: string): string {
    return `${ensureTrailingSlash(registryUrl)}a/projects/`;
  }

  private static getCacheKey(
    registryUrl: string,
    repo: string,
    type: string,
  ): string {
    return `${registryUrl}:${repo}:${type}`;
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
      registryUrl,
      releases: tags.map(({ ref, revision, object: tagObject }) => ({
        version: ref.replace(regEx(/^refs\/tags\//), ''),
        gitRef: ref.replace(regEx(/^refs\/tags\//), ''),
        newDigest: tagObject ?? revision,
      })),
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
      },
      () => this._getDigest(config, newValue),
    );
  }
}

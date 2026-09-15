import { logger } from '../../../logger/index.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { BitbucketServerHttp } from '../../../util/http/bitbucket-server.ts';
import { regEx } from '../../../util/regex.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import {
  BitbucketServerCommits,
  BitbucketServerTag,
  BitbucketServerTags,
} from './schema.ts';

export class BitbucketServerTagsDatasource extends Datasource<BitbucketServerHttp> {
  static readonly id = 'bitbucket-server-tags';

  static readonly cacheNamespace: PackageCacheNamespace = `datasource-${BitbucketServerTagsDatasource.id}`;

  constructor() {
    super(
      BitbucketServerTagsDatasource.id,
      new BitbucketServerHttp(BitbucketServerTagsDatasource.id),
    );
  }

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  static getRegistryURL(registryUrl: string): string {
    return registryUrl?.replace(regEx(/\/rest\/api\/1.0$/), '');
  }

  static getSourceUrl(
    projectKey: string,
    repositorySlug: string,
    registryUrl: string,
  ): string {
    const url = BitbucketServerTagsDatasource.getRegistryURL(registryUrl);
    return `${ensureTrailingSlash(url)}projects/${projectKey}/repos/${repositorySlug}`;
  }

  static getApiUrl(registryUrl: string): string {
    const res = BitbucketServerTagsDatasource.getRegistryURL(registryUrl);
    return `${ensureTrailingSlash(res)}rest/api/1.0/`;
  }

  static getCacheKey(
    registryUrl: string | undefined,
    repo: string,
    type: string,
  ): string {
    return `${BitbucketServerTagsDatasource.getRegistryURL(registryUrl ?? '')}:${repo}:${type}`;
  }

  // getReleases fetches list of tags for the repository
  private async _getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const { registryUrl, packageName } = config;
    const [projectKey, repositorySlug] = packageName.split('/');
    if (!registryUrl) {
      logger.debug('Missing registryUrl');
      return null;
    }

    const url = `${BitbucketServerTagsDatasource.getApiUrl(registryUrl)}projects/${projectKey}/repos/${repositorySlug}/tags`;

    const tags = await this.fetchJsonOrNull(url, BitbucketServerTags, {
      paginate: true,
    });
    if (!tags) {
      return null;
    }

    return {
      sourceUrl: BitbucketServerTagsDatasource.getSourceUrl(
        projectKey,
        repositorySlug,
        registryUrl,
      ),
      registryUrl: BitbucketServerTagsDatasource.getRegistryURL(registryUrl),
      releases: tags.map(({ displayId, hash }) => ({
        version: displayId,
        gitRef: displayId,
        newDigest: hash ?? undefined,
      })),
    };
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: BitbucketServerTagsDatasource.cacheNamespace,
        key: BitbucketServerTagsDatasource.getCacheKey(
          config.registryUrl,
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
    baseUrl: string,
    tag: string,
  ): Promise<string | null> {
    const bitbucketServerTag = (
      await this.http.getJson(`${baseUrl}/tags/${tag}`, BitbucketServerTag)
    ).body;

    return bitbucketServerTag.hash ?? null;
  }

  getTagCommit(
    baseUrl: string,
    tag: string,
    config: DigestConfig,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: BitbucketServerTagsDatasource.cacheNamespace,
        key: BitbucketServerTagsDatasource.getCacheKey(
          config.registryUrl,
          config.packageName,
          `tag-${tag}`,
        ),
      },
      () => this._getTagCommit(baseUrl, tag),
    );
  }

  // getDigest fetches the latest commit for repository main branch.
  // If newValue is provided, then getTagCommit is called
  private async _getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const { registryUrl, packageName } = config;
    const [projectKey, repositorySlug] = packageName.split('/');
    if (!registryUrl) {
      logger.debug('Missing registryUrl');
      return null;
    }

    const baseUrl = `${BitbucketServerTagsDatasource.getApiUrl(registryUrl)}projects/${projectKey}/repos/${repositorySlug}`;

    if (newValue?.length) {
      return this.getTagCommit(baseUrl, newValue, config);
    }

    const url = `${baseUrl}/commits?ignoreMissing=true`;

    const commits = await this.fetchJsonOrNull(url, BitbucketServerCommits, {
      paginate: true,
      limit: 1,
      maxPages: 1,
    });

    return commits?.[0]?.id ?? null;
  }

  override getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: BitbucketServerTagsDatasource.cacheNamespace,
        key: BitbucketServerTagsDatasource.getCacheKey(
          config.registryUrl,
          config.packageName,
          'digest',
        ),
        fallback: true,
      },
      () => this._getDigest(config, newValue),
    );
  }
}

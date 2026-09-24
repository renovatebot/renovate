import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { GiteaHttp } from '../../../util/http/gitea.ts';
import { parseUrl } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import { Commits, Tag } from './schema.ts';
import { getApiUrl, getCacheKey, getSourceUrl } from './util.ts';

/**
 * Shared implementation of the datasources which speak the Gitea API.
 *
 * Forgejo is a fork of Gitea and serves the same API, so the Forgejo
 * datasources extend the Gitea ones and only differ in their id, their default
 * registry URL and their cache namespace. The digest lookup and the caching of
 * `getReleases()` are the same for tags and releases, so they live here and a
 * subclass only fetches and maps the releases of its own endpoint.
 */
export abstract class GiteaDatasource extends Datasource {
  static readonly defaultRegistryUrls = ['https://gitea.com'];

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return GiteaDatasource.defaultRegistryUrls;
  }

  protected abstract override readonly cacheNamespace: PackageCacheNamespace;

  override http = new GiteaHttp(this.id);

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote: string;
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  /** Discriminates the cache keys of the two endpoints. */
  private readonly cacheKeyType: string;

  /**
   * @param endpoint describes the endpoint `getReleases()` reads: the
   * discriminator of its cache keys, and the field the release timestamp comes
   * from, which is rendered into the generated documentation.
   */
  protected constructor(
    id: string,
    endpoint: { cacheKeyType: string; releaseTimestampField: string },
  ) {
    super(id);
    this.cacheKeyType = endpoint.cacheKeyType;
    this.releaseTimestampNote = `The release timestamp is determined from the \`${endpoint.releaseTimestampField}\` field in the results.`;
  }

  static getSourceUrl(packageName: string, registryUrl?: string): string {
    return getSourceUrl(
      packageName,
      registryUrl ?? this.defaultRegistryUrls[0],
    );
  }

  /** Falls back to the default registry URL when none is configured. */
  protected getRegistryUrl(registryUrl?: string): string {
    return registryUrl ?? this.getDefaultRegistryUrls('')[0];
  }

  /**
   * Only results from the public default instance may be written to the
   * shared package cache; a self-hosted instance may serve private
   * repositories.
   */
  protected isPublicRegistry(registryUrl: string): boolean {
    return (
      parseUrl(registryUrl)?.hostname ===
      parseUrl(this.getDefaultRegistryUrls('')[0])?.hostname
    );
  }

  /** Fetches and maps the releases of the endpoint; `getReleases()` caches them. */
  protected abstract _getReleases(
    registryUrl: string,
    repo: string,
  ): Promise<ReleaseResult | null>;

  getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const resolvedUrl = this.getRegistryUrl(registryUrl);
    return withCache(
      {
        namespace: this.cacheNamespace,
        key: getCacheKey(resolvedUrl, repo, this.cacheKeyType),
        fallback: true,
        cacheable: this.isPublicRegistry(resolvedUrl),
      },
      () => this._getReleases(resolvedUrl, repo),
    );
  }

  // getTagCommit fetches the commit hash for the specified tag
  private async _getTagCommit(
    registryUrl: string,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    const url = `${getApiUrl(registryUrl)}repos/${repo}/tags/${tag}`;

    const { body } = await this.http.getJson(url, Tag);

    return body.commit.sha;
  }

  getTagCommit(
    registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    const resolvedUrl = this.getRegistryUrl(registryUrl);
    return withCache(
      {
        namespace: this.cacheNamespace,
        key: getCacheKey(resolvedUrl, repo, `tag-${tag}`),
        cacheable: this.isPublicRegistry(resolvedUrl),
      },
      () => this._getTagCommit(resolvedUrl, repo, tag),
    );
  }

  // getDigest fetches the latest commit for the repository's main branch,
  // however, if newValue is provided, then getTagCommit is called
  private async _getDigest(
    registryUrl: string,
    repo: string,
    newValue?: string,
  ): Promise<string | null> {
    if (newValue?.length) {
      return this.getTagCommit(registryUrl, repo, newValue);
    }

    const url = `${getApiUrl(
      registryUrl,
    )}repos/${repo}/commits?stat=false&verification=false&files=false&page=1&limit=1`;
    const { body } = await this.http.getJson(url, Commits);

    if (body.length === 0) {
      return null;
    }

    return body[0].sha;
  }

  override getDigest(
    { packageName: repo, registryUrl }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const resolvedUrl = this.getRegistryUrl(registryUrl);
    return withCache(
      {
        namespace: this.cacheNamespace,
        key: getCacheKey(resolvedUrl, repo, 'digest'),
        fallback: true,
        cacheable: this.isPublicRegistry(resolvedUrl),
      },
      () => this._getDigest(resolvedUrl, repo, newValue),
    );
  }
}

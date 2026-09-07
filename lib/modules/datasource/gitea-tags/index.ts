import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { GiteaHttp } from '../../../util/http/gitea.ts';
import { Datasource } from '../datasource.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import { Commits, Tag, Tags } from './schema.ts';
import { getApiUrl, getCacheKey, getSourceUrl } from './util.ts';

export class GiteaTagsDatasource extends Datasource {
  static readonly id: string = 'gitea-tags';

  override http = new GiteaHttp(GiteaTagsDatasource.id);

  static readonly defaultRegistryUrls = ['https://gitea.com'];

  /**
   * Default registry URL of the concrete datasource, mirrored on the instance
   * so that inherited methods resolve it for the subclass.
   */
  protected readonly defaultRegistryUrl =
    GiteaTagsDatasource.defaultRegistryUrls[0];

  protected readonly cacheNamespace: PackageCacheNamespace =
    'datasource-gitea-tags';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `created` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  constructor(id: string = GiteaTagsDatasource.id) {
    super(id);
  }

  static getSourceUrl(packageName: string, registryUrl?: string): string {
    // fallback to default API endpoint if custom not provided
    return getSourceUrl(
      packageName,
      registryUrl ?? this.defaultRegistryUrls[0],
    );
  }

  protected getRegistryUrl(registryUrl?: string): string {
    // fallback to default API endpoint if custom not provided
    return registryUrl ?? this.defaultRegistryUrl;
  }

  // getReleases fetches list of tags for the repository
  private async _getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const resolvedUrl = this.getRegistryUrl(registryUrl);
    const url = `${getApiUrl(resolvedUrl)}repos/${repo}/tags`;
    const tags = (
      await this.http.getJson(
        url,
        {
          paginate: true,
        },
        Tags,
      )
    ).body;

    const dependency: ReleaseResult = {
      sourceUrl: getSourceUrl(repo, resolvedUrl),
      registryUrl: resolvedUrl,
      releases: tags.map(({ name, commit }) => ({
        version: name,
        gitRef: name,
        newDigest: commit.sha,
        releaseTimestamp: commit.created,
      })),
    };

    return dependency;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: this.cacheNamespace,
        key: getCacheKey(
          this.getRegistryUrl(config.registryUrl),
          config.packageName,
          'tags',
        ),
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  // getTagCommit fetched the commit has for specified tag
  private async _getTagCommit(
    registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    const url = `${getApiUrl(
      this.getRegistryUrl(registryUrl),
    )}repos/${repo}/tags/${tag}`;

    const { body } = await this.http.getJson(url, Tag);

    return body.commit.sha;
  }

  getTagCommit(
    registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: this.cacheNamespace,
        key: getCacheKey(this.getRegistryUrl(registryUrl), repo, `tag-${tag}`),
      },
      () => this._getTagCommit(registryUrl, repo, tag),
    );
  }

  // getDigest fetched the latest commit for repository main branch
  // however, if newValue is provided, then getTagCommit is called
  private async _getDigest(
    { packageName: repo, registryUrl }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    if (newValue?.length) {
      return this.getTagCommit(registryUrl, repo, newValue);
    }

    const url = `${getApiUrl(
      this.getRegistryUrl(registryUrl),
    )}repos/${repo}/commits?stat=false&verification=false&files=false&page=1&limit=1`;
    const { body } = await this.http.getJson(url, Commits);

    if (body.length === 0) {
      return null;
    }

    return body[0].sha;
  }

  override getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: this.cacheNamespace,
        key: getCacheKey(
          this.getRegistryUrl(config.registryUrl),
          config.packageName,
          'digest',
        ),
        fallback: true,
      },
      () => this._getDigest(config, newValue),
    );
  }
}

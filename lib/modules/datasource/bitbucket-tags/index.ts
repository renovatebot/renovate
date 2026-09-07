import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { BitbucketHttp } from '../../../util/http/bitbucket.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { RepoInfo } from '../../platform/bitbucket/schema.ts';
import { GitHostTagsDigestDatasource } from '../git-host-tags.ts';
import type { GetReleasesConfig, GitHostTag } from '../types.ts';
import { BitbucketCommits, BitbucketTag, BitbucketTags } from './schema.ts';

export class BitbucketTagsDatasource extends GitHostTagsDigestDatasource {
  static readonly id = 'bitbucket-tags';

  bitbucketHttp = new BitbucketHttp(BitbucketTagsDatasource.id);

  static readonly customRegistrySupport = true;

  static readonly registryStrategy = 'first';

  static readonly defaultRegistryUrls = ['https://bitbucket.org'];

  static readonly releaseTimestampSupport = true;
  static readonly releaseTimestampNote =
    'The release timestamp is determined from the `date` field in the results.';
  static readonly sourceUrlSupport = 'package';
  static readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  protected readonly cacheNamespace: PackageCacheNamespace = `datasource-${BitbucketTagsDatasource.id}`;

  constructor() {
    super(BitbucketTagsDatasource.id);
  }

  static getRegistryURL(registryUrl?: string): string {
    // fallback to default API endpoint if custom not provided
    return registryUrl ?? this.defaultRegistryUrls[0];
  }

  static getSourceUrl(packageName: string, registryUrl?: string): string {
    const url = BitbucketTagsDatasource.getRegistryURL(registryUrl);
    const normalizedUrl = ensureTrailingSlash(url);
    return `${normalizedUrl}${packageName}`;
  }

  getRegistryUrl(registryUrl?: string): string {
    return BitbucketTagsDatasource.getRegistryURL(registryUrl);
  }

  getSourceUrl(packageName: string, registryUrl?: string): string {
    return BitbucketTagsDatasource.getSourceUrl(packageName, registryUrl);
  }

  // fetchTags fetches list of tags for the repository
  protected async fetchTags({
    packageName: repo,
  }: GetReleasesConfig): Promise<GitHostTag[]> {
    const url = `/2.0/repositories/${repo}/refs/tags`;
    const bitbucketTags = (
      await this.bitbucketHttp.getJson(url, { paginate: true }, BitbucketTags)
    ).body;

    return bitbucketTags.map(({ name, target }) => ({
      version: name,
      releaseTimestamp: asTimestamp(target?.date),
    }));
  }

  // fetchTagCommit fetches the commit hash for the specified tag
  protected async fetchTagCommit(
    _registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    const url = `/2.0/repositories/${repo}/refs/tags/${tag}`;

    const bitbucketTag = (await this.bitbucketHttp.getJson(url, BitbucketTag))
      .body;

    return bitbucketTag.target?.hash ?? null;
  }

  private async _getMainBranch(
    _registryUrl: string,
    repo: string,
  ): Promise<string> {
    return (
      await this.bitbucketHttp.getJson(`/2.0/repositories/${repo}`, RepoInfo)
    ).body.mainbranch;
  }

  getMainBranch(registryUrl: string, repo: string): Promise<string> {
    return withCache(
      {
        namespace: this.cacheNamespace,
        key: this.getCacheKey(registryUrl, repo, 'mainbranch'),
        ttlMinutes: 60,
      },
      () => this._getMainBranch(registryUrl, repo),
    );
  }

  // fetchLatestCommit fetches the latest commit for the repository main branch
  protected async fetchLatestCommit(
    registryUrl: string | undefined,
    repo: string,
  ): Promise<string | null> {
    const mainBranch = await this.getMainBranch(
      BitbucketTagsDatasource.getRegistryURL(registryUrl),
      repo,
    );

    const url = `/2.0/repositories/${repo}/commits/${mainBranch}`;
    const bitbucketCommits = (
      await this.bitbucketHttp.getJson(url, BitbucketCommits)
    ).body;

    if (bitbucketCommits.length === 0) {
      return null;
    }

    return bitbucketCommits[0].hash;
  }
}

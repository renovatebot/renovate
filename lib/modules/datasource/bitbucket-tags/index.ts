import { cache } from '../../../util/cache/package/decorator';
import type { PackageCacheNamespace } from '../../../util/cache/package/types';
import { BitbucketHttp } from '../../../util/http/bitbucket';
import { ensureTrailingSlash } from '../../../util/url';
import { RepoInfo } from '../../platform/bitbucket/schema';
import type { PagedResult } from '../../platform/bitbucket/types';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import type { BitbucketCommit, BitbucketTag } from './types';

export class BitbucketTagsDatasource extends Datasource {
  static readonly id = 'bitbucket-tags';

  bitbucketHttp = new BitbucketHttp(BitbucketTagsDatasource.id);

  static readonly customRegistrySupport = true;

  static readonly registryStrategy = 'first';

  static readonly defaultRegistryUrls = ['https://bitbucket.org'];

  static readonly cacheNamespace: PackageCacheNamespace = `datasource-${BitbucketTagsDatasource.id}`;

  constructor() {
    super(BitbucketTagsDatasource.id);
  }

  static getRegistryURL(registryUrl?: string): string {
    // fallback to default API endpoint if custom not provided
    return registryUrl ?? this.defaultRegistryUrls[0];
  }

  static getCacheKey(
    registryUrl: string | undefined,
    repo: string,
    type: string,
  ): string {
    return `${BitbucketTagsDatasource.getRegistryURL(
      registryUrl,
    )}:${repo}:${type}`;
  }

  static getSourceUrl(packageName: string, registryUrl?: string): string {
    const url = BitbucketTagsDatasource.getRegistryURL(registryUrl);
    const normalizedUrl = ensureTrailingSlash(url);
    return `${normalizedUrl}${packageName}`;
  }

  // getReleases fetches list of tags for the repository
  @cache({
    namespace: BitbucketTagsDatasource.cacheNamespace,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      BitbucketTagsDatasource.getCacheKey(registryUrl, packageName, 'tags'),
  })
  async getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const url = `/2.0/repositories/${repo}/refs/tags`;
    const bitbucketTags = (
      await this.bitbucketHttp.getJson<PagedResult<BitbucketTag>>(url, {
        paginate: true,
      })
    ).body.values;

    const dependency: ReleaseResult = {
      sourceUrl: BitbucketTagsDatasource.getSourceUrl(repo, registryUrl),
      registryUrl: BitbucketTagsDatasource.getRegistryURL(registryUrl),
      releases: bitbucketTags.map(({ name, target }) => ({
        version: name,
        gitRef: name,
        releaseTimestamp: target?.date,
      })),
    };

    return dependency;
  }

  // getTagCommit fetched the commit has for specified tag
  @cache({
    namespace: BitbucketTagsDatasource.cacheNamespace,
    key: (registryUrl: string | undefined, repo: string, tag: string): string =>
      BitbucketTagsDatasource.getCacheKey(registryUrl, repo, `tag-${tag}`),
  })
  async getTagCommit(
    _registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    const url = `/2.0/repositories/${repo}/refs/tags/${tag}`;

    const bitbucketTag = (await this.bitbucketHttp.getJson<BitbucketTag>(url))
      .body;

    return bitbucketTag.target?.hash ?? null;
  }

  @cache({
    namespace: BitbucketTagsDatasource.cacheNamespace,
    key: (registryUrl: string, repo: string) =>
      BitbucketTagsDatasource.getCacheKey(registryUrl, repo, 'mainbranch'),
    ttlMinutes: 60,
  })
  async getMainBranch(repo: string): Promise<string> {
    return (
      await this.bitbucketHttp.getJson(`/2.0/repositories/${repo}`, RepoInfo)
    ).body.mainbranch;
  }

  // getDigest fetched the latest commit for repository main branch
  // however, if newValue is provided, then getTagCommit is called
  @cache({
    namespace: BitbucketTagsDatasource.cacheNamespace,
    key: ({ registryUrl, packageName }: DigestConfig) =>
      BitbucketTagsDatasource.getCacheKey(registryUrl, packageName, 'digest'),
  })
  override async getDigest(
    { packageName: repo, registryUrl }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    if (newValue?.length) {
      return this.getTagCommit(registryUrl, repo, newValue);
    }

    const mainBranch = await this.getMainBranch(repo);

    const url = `/2.0/repositories/${repo}/commits/${mainBranch}`;
    const bitbucketCommits = (
      await this.bitbucketHttp.getJson<PagedResult<BitbucketCommit>>(url)
    ).body;

    if (bitbucketCommits.values.length === 0) {
      return null;
    }

    return bitbucketCommits.values[0].hash;
  }
}

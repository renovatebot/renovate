import * as utils from '../../platform/bitbucket/utils';
import { cache } from '../../util/cache/package/decorator';
import { BitbucketHttp } from '../../util/http/bitbucket';
import { ensureTrailingSlash } from '../../util/url';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { BitbucketCommit, BitbucketTag } from './types';

export class BitBucketTagsDatasource extends Datasource {
  bitbucketHttp = new BitbucketHttp(BitBucketTagsDatasource.id);

  static readonly id = 'bitbucket-tags';

  static readonly customRegistrySupport = true;

  static readonly registryStrategy = 'first';

  static readonly defaultRegistryUrls = ['https://bitbucket.org'];

  static readonly cacheNamespace = `datasource-${BitBucketTagsDatasource.id}`;

  constructor() {
    super(BitBucketTagsDatasource.id);
  }

  static getRegistryURL(registryUrl?: string): string {
    // fallback to default API endpoint if custom not provided
    return registryUrl ?? this.defaultRegistryUrls[0];
  }

  static getCacheKey(
    registryUrl: string | undefined,
    repo: string,
    type: string
  ): string {
    return `${BitBucketTagsDatasource.getRegistryURL(
      registryUrl
    )}:${repo}:${type}`;
  }

  static getSourceUrl(lookupName: string, registryUrl?: string): string {
    const url = BitBucketTagsDatasource.getRegistryURL(registryUrl);
    const normalizedUrl = ensureTrailingSlash(url);
    return `${normalizedUrl}${lookupName}`;
  }

  // getReleases fetches list of tags for the repository
  @cache({
    namespace: BitBucketTagsDatasource.cacheNamespace,
    key: ({ registryUrl, lookupName }: GetReleasesConfig) =>
      BitBucketTagsDatasource.getCacheKey(registryUrl, lookupName, 'tags'),
  })
  async getReleases({
    registryUrl,
    lookupName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const url = `/2.0/repositories/${repo}/refs/tags`;

    const bitbucketTags = (
      await this.bitbucketHttp.getJson<utils.PagedResult<BitbucketTag>>(url)
    ).body;

    const releases = bitbucketTags.values.map(({ name, target }) => ({
      version: name,
      gitRef: name,
      releaseTimestamp: target?.date,
    }));

    const dependency: ReleaseResult = {
      sourceUrl: BitBucketTagsDatasource.getSourceUrl(repo, registryUrl),
      releases,
    };

    return dependency;
  }

  // getTagCommit fetched the commit has for specified tag
  @cache({
    namespace: BitBucketTagsDatasource.cacheNamespace,
    key: (registryUrl, repo, tag: string) =>
      BitBucketTagsDatasource.getCacheKey(registryUrl, repo, `tag-${tag}`),
  })
  async getTagCommit(repo: string, tag: string): Promise<string | null> {
    const url = `/2.0/repositories/${repo}/refs/tags/${tag}`;

    const bitbucketTag = (await this.bitbucketHttp.getJson<BitbucketTag>(url))
      .body;

    return bitbucketTag.target?.hash ?? null;
  }

  @cache({
    namespace: BitBucketTagsDatasource.cacheNamespace,
    key: (registryUrl: string, repo: string) =>
      BitBucketTagsDatasource.getCacheKey(registryUrl, repo, 'mainbranch'),
    ttlMinutes: 60,
  })
  async getMainBranch(repo: string): Promise<string> {
    return (
      await this.bitbucketHttp.getJson<utils.RepoInfoBody>(
        `/2.0/repositories/${repo}`
      )
    ).body.mainbranch.name;
  }

  // getDigest fetched the latest commit for repository main branch
  // however, if newValue is provided, then getTagCommit is called
  @cache({
    namespace: BitBucketTagsDatasource.cacheNamespace,
    key: ({ registryUrl, lookupName }: DigestConfig) =>
      BitBucketTagsDatasource.getCacheKey(registryUrl, lookupName, 'digest'),
  })
  override async getDigest(
    { lookupName: repo }: DigestConfig,
    newValue?: string
  ): Promise<string | null> {
    if (newValue?.length) {
      return this.getTagCommit(repo, newValue);
    }

    const mainBranch = await this.getMainBranch(repo);

    const url = `/2.0/repositories/${repo}/commits/${mainBranch}`;
    const bitbucketCommits = (
      await this.bitbucketHttp.getJson<utils.PagedResult<BitbucketCommit>>(url)
    ).body;

    if (bitbucketCommits.values.length === 0) {
      return null;
    }

    return bitbucketCommits.values[0].hash;
  }
}

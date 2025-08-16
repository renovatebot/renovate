import { cache } from '../../../util/cache/package/decorator';
import type { PackageCacheNamespace } from '../../../util/cache/package/types';
import { ForgejoHttp } from '../../../util/http/forgejo';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { Commits, Tag, Tags } from './schema';

export class ForgejoTagsDatasource extends Datasource {
  static readonly id = 'forgejo-tags';

  override http = new ForgejoHttp(ForgejoTagsDatasource.id);

  static readonly defaultRegistryUrls = ['https://code.forgejo.org'];

  private static readonly cacheNamespace: PackageCacheNamespace = `datasource-${ForgejoTagsDatasource.id}`;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `created` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  constructor() {
    super(ForgejoTagsDatasource.id);
  }

  static getRegistryURL(registryUrl?: string): string {
    // fallback to default API endpoint if custom not provided
    return registryUrl ?? this.defaultRegistryUrls[0];
  }

  static getApiUrl(registryUrl?: string): string {
    const res = ForgejoTagsDatasource.getRegistryURL(registryUrl).replace(
      regEx(/\/api\/v1$/),
      '',
    );
    return `${ensureTrailingSlash(res)}api/v1/`;
  }

  static getCacheKey(
    registryUrl: string | undefined,
    repo: string,
    type: string,
  ): string {
    return `${ForgejoTagsDatasource.getRegistryURL(registryUrl)}:${repo}:${type}`;
  }

  static getSourceUrl(packageName: string, registryUrl?: string): string {
    const url = ForgejoTagsDatasource.getRegistryURL(registryUrl);
    const normalizedUrl = ensureTrailingSlash(url);
    return `${normalizedUrl}${packageName}`;
  }

  // getReleases fetches list of tags for the repository
  @cache({
    namespace: ForgejoTagsDatasource.cacheNamespace,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      ForgejoTagsDatasource.getCacheKey(registryUrl, packageName, 'tags'),
  })
  async getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const url = `${ForgejoTagsDatasource.getApiUrl(
      registryUrl,
    )}repos/${repo}/tags`;
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
      sourceUrl: ForgejoTagsDatasource.getSourceUrl(repo, registryUrl),
      registryUrl: ForgejoTagsDatasource.getRegistryURL(registryUrl),
      releases: tags.map(({ name, commit }) => ({
        version: name,
        gitRef: name,
        newDigest: commit.sha,
        releaseTimestamp: commit.created,
      })),
    };

    return dependency;
  }

  // getTagCommit fetched the commit has for specified tag
  @cache({
    namespace: ForgejoTagsDatasource.cacheNamespace,
    key: (registryUrl: string | undefined, repo: string, tag: string): string =>
      ForgejoTagsDatasource.getCacheKey(registryUrl, repo, `tag-${tag}`),
  })
  async getTagCommit(
    registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    const url = `${ForgejoTagsDatasource.getApiUrl(
      registryUrl,
    )}repos/${repo}/tags/${tag}`;

    const { body } = await this.http.getJson(url, Tag);

    return body.commit.sha;
  }

  // getDigest fetched the latest commit for repository main branch
  // however, if newValue is provided, then getTagCommit is called
  @cache({
    namespace: ForgejoTagsDatasource.cacheNamespace,
    key: ({ registryUrl, packageName }: DigestConfig) =>
      ForgejoTagsDatasource.getCacheKey(registryUrl, packageName, 'digest'),
  })
  override async getDigest(
    { packageName: repo, registryUrl }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    if (newValue?.length) {
      return this.getTagCommit(registryUrl, repo, newValue);
    }

    const url = `${ForgejoTagsDatasource.getApiUrl(
      registryUrl,
    )}repos/${repo}/commits?stat=false&verification=false&files=false&page=1&limit=1`;
    const { body } = await this.http.getJson(url, Commits);

    if (body.length === 0) {
      return null;
    }

    return body[0].sha;
  }
}

import { cache } from '../../../util/cache/package/decorator';
import type { PackageCacheNamespace } from '../../../util/cache/package/types';
import { ForgejoHttp } from '../../../util/http/forgejo';
import { Datasource } from '../datasource';
import { ForgejoTagsDatasource } from '../forgejo-tags';
import { Commits, Tag } from '../forgejo-tags/schema';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { Releases } from './schema';

export class ForgejoReleasesDatasource extends Datasource {
  static readonly id = 'forgejo-releases';

  override http = new ForgejoHttp(ForgejoReleasesDatasource.id);

  static readonly defaultRegistryUrls = ['https://code.forgejo.org'];

  private static readonly cacheNamespace: PackageCacheNamespace = `datasource-${ForgejoReleasesDatasource.id}`;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `published_at` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  constructor() {
    super(ForgejoReleasesDatasource.id);
  }

  // getReleases fetches list of tags for the repository
  @cache({
    namespace: ForgejoReleasesDatasource.cacheNamespace,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      ForgejoTagsDatasource.getCacheKey(registryUrl, packageName, 'releases'),
  })
  async getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const url = `${ForgejoTagsDatasource.getApiUrl(
      registryUrl,
    )}repos/${repo}/releases?draft=false`;
    const tags = (
      await this.http.getJson(
        url,
        {
          paginate: true,
        },
        Releases,
      )
    ).body;

    const dependency: ReleaseResult = {
      sourceUrl: ForgejoTagsDatasource.getSourceUrl(repo, registryUrl),
      registryUrl: ForgejoTagsDatasource.getRegistryURL(registryUrl),
      releases: tags.map(({ tag_name, published_at, prerelease }) => ({
        version: tag_name,
        gitRef: tag_name,
        releaseTimestamp: published_at,
        isStable: !prerelease,
      })),
    };

    return dependency;
  }

  // getTagCommit fetched the commit has for specified tag
  @cache({
    namespace: ForgejoReleasesDatasource.cacheNamespace,
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
    namespace: ForgejoReleasesDatasource.cacheNamespace,
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

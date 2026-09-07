import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { ForgejoHttp } from '../../../util/http/forgejo.ts';
import { regEx } from '../../../util/regex.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { GitHostTagsDigestDatasource } from '../git-host-tags.ts';
import type { GetReleasesConfig, GitHostTag } from '../types.ts';
import { Commits, Tag, Tags } from './schema.ts';

export class ForgejoTagsDatasource extends GitHostTagsDigestDatasource {
  static readonly id = 'forgejo-tags';

  override http = new ForgejoHttp(ForgejoTagsDatasource.id);

  static readonly defaultRegistryUrls = ['https://code.forgejo.org'];

  protected readonly cacheNamespace: PackageCacheNamespace = `datasource-${ForgejoTagsDatasource.id}`;

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

  getRegistryUrl(registryUrl?: string): string {
    return ForgejoTagsDatasource.getRegistryURL(registryUrl);
  }

  getSourceUrl(packageName: string, registryUrl?: string): string {
    return ForgejoTagsDatasource.getSourceUrl(packageName, registryUrl);
  }

  // fetchTags fetches list of tags for the repository
  protected async fetchTags({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<GitHostTag[]> {
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

    return tags.map(({ name, commit }) => ({
      version: name,
      newDigest: commit.sha,
      releaseTimestamp: commit.created,
    }));
  }

  // fetchTagCommit fetches the commit hash for the specified tag
  protected async fetchTagCommit(
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

  // fetchLatestCommit fetches the latest commit for the repository main branch
  protected async fetchLatestCommit(
    registryUrl: string | undefined,
    repo: string,
  ): Promise<string | null> {
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

import { cache } from '../../../util/cache/package/decorator';
import { GiteaHttp } from '../../../util/http/gitea';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { CommitsSchema, TagSchema, TagsSchema } from './schema';

export class GiteaTagsDatasource extends Datasource {
  static readonly id = 'gitea-tags';

  override http = new GiteaHttp(GiteaTagsDatasource.id);

  static readonly defaultRegistryUrls = ['https://gitea.com'];

  private static readonly cacheNamespace = `datasource-${GiteaTagsDatasource.id}`;

  constructor() {
    super(GiteaTagsDatasource.id);
  }

  static getRegistryURL(registryUrl?: string): string {
    // fallback to default API endpoint if custom not provided
    return registryUrl ?? this.defaultRegistryUrls[0];
  }

  static getApiUrl(registryUrl?: string): string {
    const res = GiteaTagsDatasource.getRegistryURL(registryUrl).replace(
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
    return `${GiteaTagsDatasource.getRegistryURL(registryUrl)}:${repo}:${type}`;
  }

  static getSourceUrl(packageName: string, registryUrl?: string): string {
    const url = GiteaTagsDatasource.getRegistryURL(registryUrl);
    const normalizedUrl = ensureTrailingSlash(url);
    return `${normalizedUrl}${packageName}`;
  }

  // getReleases fetches list of tags for the repository
  @cache({
    namespace: GiteaTagsDatasource.cacheNamespace,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      GiteaTagsDatasource.getCacheKey(registryUrl, packageName, 'tags'),
  })
  async getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const url = `${GiteaTagsDatasource.getApiUrl(
      registryUrl,
    )}repos/${repo}/tags`;
    const tags = (
      await this.http.getJson(
        url,
        {
          paginate: true,
        },
        TagsSchema,
      )
    ).body;

    const dependency: ReleaseResult = {
      sourceUrl: GiteaTagsDatasource.getSourceUrl(repo, registryUrl),
      registryUrl: GiteaTagsDatasource.getRegistryURL(registryUrl),
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
    namespace: GiteaTagsDatasource.cacheNamespace,
    key: (registryUrl: string | undefined, repo: string, tag: string): string =>
      GiteaTagsDatasource.getCacheKey(registryUrl, repo, `tag-${tag}`),
  })
  async getTagCommit(
    registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    const url = `${GiteaTagsDatasource.getApiUrl(
      registryUrl,
    )}repos/${repo}/tags/${tag}`;

    const { body } = await this.http.getJson(url, TagSchema);

    return body.commit.sha;
  }

  // getDigest fetched the latest commit for repository main branch
  // however, if newValue is provided, then getTagCommit is called
  @cache({
    namespace: GiteaTagsDatasource.cacheNamespace,
    key: ({ registryUrl, packageName }: DigestConfig) =>
      GiteaTagsDatasource.getCacheKey(registryUrl, packageName, 'digest'),
  })
  override async getDigest(
    { packageName: repo, registryUrl }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    if (newValue?.length) {
      return this.getTagCommit(registryUrl, repo, newValue);
    }

    const url = `${GiteaTagsDatasource.getApiUrl(
      registryUrl,
    )}repos/${repo}/commits?stat=false&verification=false&files=false&page=1&limit=1`;
    const { body } = await this.http.getJson(url, CommitsSchema);

    if (body.length === 0) {
      return null;
    }

    return body[0].sha;
  }
}

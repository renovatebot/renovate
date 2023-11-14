import { cache } from '../../../util/cache/package/decorator';
import { GiteaHttp } from '../../../util/http/gitea';
import { Datasource } from '../datasource';
import { GiteaTagsDatasource } from '../gitea-tags';
import { CommitsSchema, TagSchema } from '../gitea-tags/schema';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { ReleasesSchema } from './schema';

export class GiteaReleasesDatasource extends Datasource {
  static readonly id = 'gitea-releases';

  override http = new GiteaHttp(GiteaReleasesDatasource.id);

  static readonly defaultRegistryUrls = ['https://gitea.com'];

  private static readonly cacheNamespace = `datasource-${GiteaReleasesDatasource.id}`;

  constructor() {
    super(GiteaReleasesDatasource.id);
  }

  // getReleases fetches list of tags for the repository
  @cache({
    namespace: GiteaReleasesDatasource.cacheNamespace,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      GiteaTagsDatasource.getCacheKey(registryUrl, packageName, 'releases'),
  })
  async getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const url = `${GiteaTagsDatasource.getApiUrl(
      registryUrl,
    )}repos/${repo}/releases?draft=false`;
    const tags = (
      await this.http.getJson(
        url,
        {
          paginate: true,
        },
        ReleasesSchema,
      )
    ).body;

    const dependency: ReleaseResult = {
      sourceUrl: GiteaTagsDatasource.getSourceUrl(repo, registryUrl),
      registryUrl: GiteaTagsDatasource.getRegistryURL(registryUrl),
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
    namespace: GiteaReleasesDatasource.cacheNamespace,
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
    namespace: GiteaReleasesDatasource.cacheNamespace,
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

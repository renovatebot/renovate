import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { GiteaHttp } from '../../../util/http/gitea.ts';
import { Datasource } from '../datasource.ts';
import { GiteaTagsDatasource } from '../gitea-tags/index.ts';
import { Commits, Tag } from '../gitea-tags/schema.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import { Releases } from './schema.ts';

export class GiteaReleasesDatasource extends Datasource {
  static readonly id = 'gitea-releases';

  override http = new GiteaHttp(GiteaReleasesDatasource.id);

  static readonly defaultRegistryUrls = ['https://gitea.com'];

  private static readonly cacheNamespace: PackageCacheNamespace = `datasource-${GiteaReleasesDatasource.id}`;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `published_at` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  constructor() {
    super(GiteaReleasesDatasource.id);
  }

  // getReleases fetches list of tags for the repository
  private async _getReleases({
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
        Releases,
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

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: GiteaReleasesDatasource.cacheNamespace,
        key: GiteaTagsDatasource.getCacheKey(
          config.registryUrl,
          config.packageName,
          'releases',
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
    const url = `${GiteaTagsDatasource.getApiUrl(
      registryUrl,
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
        namespace: GiteaReleasesDatasource.cacheNamespace,
        key: GiteaTagsDatasource.getCacheKey(registryUrl, repo, `tag-${tag}`),
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

    const url = `${GiteaTagsDatasource.getApiUrl(
      registryUrl,
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
        namespace: GiteaReleasesDatasource.cacheNamespace,
        key: GiteaTagsDatasource.getCacheKey(
          config.registryUrl,
          config.packageName,
          'digest',
        ),
        fallback: true,
      },
      () => this._getDigest(config, newValue),
    );
  }
}

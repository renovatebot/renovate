import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { GithubReleasesDatasource } from '../github-releases';
import { getApiBaseUrl, getSourceUrl } from '../github-releases/common';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { CacheableGithubTags } from './cache';

export class GithubTagsDatasource extends GithubReleasesDatasource {
  static override readonly id = 'github-tags';

  private tagsCache: CacheableGithubTags;

  constructor() {
    super(GithubTagsDatasource.id);
    this.tagsCache = new CacheableGithubTags(this.http);
  }

  async getTagCommit(
    registryUrl: string | undefined,
    packageName: string,
    tag: string
  ): Promise<string | null> {
    let result: string | null = null;
    const tagReleases = await this.tagsCache.getItems({
      packageName,
      registryUrl,
    });
    const tagRelease = tagReleases.find(({ version }) => version === tag);
    if (tagRelease) {
      result = tagRelease.hash;
    }
    return result;
  }

  @cache({
    ttlMinutes: 10,
    namespace: `datasource-${GithubTagsDatasource.id}`,
    key: (registryUrl: string, githubRepo: string) =>
      `${registryUrl}:${githubRepo}:commit`,
  })
  async getCommit(
    registryUrl: string | undefined,
    githubRepo: string
  ): Promise<string | null> {
    const apiBaseUrl = getApiBaseUrl(registryUrl);
    let digest: string | null = null;
    try {
      const url = `${apiBaseUrl}repos/${githubRepo}/commits?per_page=1`;
      const res = await this.http.getJson<{ sha: string }[]>(url);
      digest = res.body[0].sha;
    } catch (err) {
      logger.debug(
        { githubRepo: githubRepo, err, registryUrl },
        'Error getting latest commit from GitHub repo'
      );
    }
    return digest;
  }

  /**
   * github.getDigest
   *
   * The `newValue` supplied here should be a valid tag for the docker image.
   *
   * Returns the latest commit hash for the repository.
   */
  override getDigest(
    { packageName: repo, registryUrl }: Partial<DigestConfig>,
    newValue?: string
  ): Promise<string | null> {
    return newValue
      ? this.getTagCommit(registryUrl, repo!, newValue)
      : this.getCommit(registryUrl, repo!);
  }

  @cache({
    ttlMinutes: 10,
    namespace: `datasource-${GithubTagsDatasource.id}`,
    key: /*istanbul ignore next*/ ({
      registryUrl,
      packageName: repo,
    }: GetReleasesConfig) => `${registryUrl!}:${repo}:tags`,
    cacheable: () => process.env.DISABLE_GITHUB_CACHE === 'true',
  })
  override async getReleases(
    config: GetReleasesConfig
  ): Promise<ReleaseResult> {
    // istanbul ignore if
    if (process.env.DISABLE_GITHUB_CACHE === 'true') {
      const { registryUrl, packageName: repo } = config;
      const apiBaseUrl = getApiBaseUrl(registryUrl);
      // tag
      const url = `${apiBaseUrl}repos/${repo}/tags?per_page=100`;

      const versions = (
        await this.http.getJson<{ name: string }[]>(url, {
          paginate: true,
        })
      ).body.map((o) => o.name);

      const dependency: ReleaseResult = {
        sourceUrl: getSourceUrl(repo, registryUrl),
        releases: versions.map((version) => ({
          version,
          gitRef: version,
        })),
      };
      return dependency;
    } else {
      const tagReleases = await this.tagsCache.getItems(config);

      const tagsResult: ReleaseResult = {
        sourceUrl: getSourceUrl(config.packageName, config.registryUrl),
        releases: tagReleases.map((item) => ({
          ...item,
          gitRef: item.version,
        })),
      };

      return tagsResult;
    }
  }
}

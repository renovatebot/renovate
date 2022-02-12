import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { GithubReleasesDatasource } from '../github-releases';
import { getApiBaseUrl, getSourceUrl } from '../github-releases/common';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import type { GitHubTag, TagResponse } from './types';

export class GithubTagsDatasource extends GithubReleasesDatasource {
  static override readonly id = 'github-tags';

  constructor() {
    super(GithubTagsDatasource.id);
  }

  @cache({
    ttlMinutes: 120,
    namespace: `datasource-${GithubTagsDatasource.id}`,
    key: (registryUrl: string, githubRepo: string, tag: string) =>
      `${registryUrl}:${githubRepo}:tag-${tag}`,
  })
  async getTagCommit(
    registryUrl: string,
    githubRepo: string,
    tag: string
  ): Promise<string | null> {
    const apiBaseUrl = getApiBaseUrl(registryUrl);
    let digest: string | null = null;
    try {
      const url = `${apiBaseUrl}repos/${githubRepo}/git/refs/tags/${tag}`;
      const res = (await this.http.getJson<TagResponse>(url)).body.object;
      if (res.type === 'commit') {
        digest = res.sha;
      } else if (res.type === 'tag') {
        digest = (await this.http.getJson<TagResponse>(res.url)).body.object
          .sha;
      } else {
        logger.warn({ res }, 'Unknown git tag refs type');
      }
    } catch (err) {
      logger.debug(
        { githubRepo, err },
        'Error getting tag commit from GitHub repo'
      );
    }
    return digest;
  }

  @cache({
    ttlMinutes: 10,
    namespace: `datasource-${GithubTagsDatasource.id}`,
    key: (registryUrl: string, githubRepo: string) =>
      `${registryUrl}:${githubRepo}:commit`,
  })
  async getCommit(
    registryUrl: string,
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
    { lookupName: repo, registryUrl }: Partial<DigestConfig>,
    newValue?: string
  ): Promise<string | null> {
    return newValue
      ? this.getTagCommit(registryUrl, repo, newValue)
      : this.getCommit(registryUrl, repo);
  }

  @cache({
    ttlMinutes: 10,
    namespace: `datasource-${GithubTagsDatasource.id}`,
    key: ({ registryUrl, lookupName: repo }: GetReleasesConfig) =>
      `${registryUrl}:${repo}:tags`,
  })
  async getTags({
    registryUrl,
    lookupName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const apiBaseUrl = getApiBaseUrl(registryUrl);
    // tag
    const url = `${apiBaseUrl}repos/${repo}/tags?per_page=100`;

    const versions = (
      await this.http.getJson<GitHubTag[]>(url, {
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
  }

  override async getReleases(
    config: GetReleasesConfig
  ): Promise<ReleaseResult | null> {
    const tagsResult = await this.getTags(config);

    try {
      // Fetch additional data from releases endpoint when possible
      const releasesResult = await super.getReleases(config);
      const releaseByVersion = {};
      releasesResult?.releases?.forEach((release) => {
        const key = release.version;
        const value = { ...release };
        delete value.version;
        releaseByVersion[key] = value;
      });

      const mergedReleases = [];
      tagsResult.releases.forEach((tag) => {
        const release = releaseByVersion[tag.version];
        mergedReleases.push({ ...release, ...tag });
      });

      tagsResult.releases = mergedReleases;
    } catch (e) {
      // no-op
    }

    return tagsResult;
  }
}

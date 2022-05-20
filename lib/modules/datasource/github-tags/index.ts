import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { GithubReleasesDatasource } from '../github-releases';
import { getApiBaseUrl, getSourceUrl } from '../github-releases/common';
import type {
  DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types';
import { CacheableGithubTags } from './cache';
import type { TagResponse } from './types';

export class GithubTagsDatasource extends GithubReleasesDatasource {
  static override readonly id = 'github-tags';

  private tagsCache: CacheableGithubTags;

  constructor() {
    super(GithubTagsDatasource.id);
    this.tagsCache = new CacheableGithubTags(this.http);
  }

  @cache({
    ttlMinutes: 120,
    namespace: `datasource-${GithubTagsDatasource.id}`,
    key: (registryUrl: string, githubRepo: string, tag: string) =>
      `${registryUrl}:${githubRepo}:tag-${tag}`,
  })
  async getTagCommit(
    registryUrl: string | undefined,
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
      ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        this.getTagCommit(registryUrl, repo!, newValue)
      : // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        this.getCommit(registryUrl, repo!);
  }

  override async getReleases(
    config: GetReleasesConfig
  ): Promise<ReleaseResult | null> {
    const tagReleases = await this.tagsCache.getItems(config);

    // istanbul ignore if
    if (!tagReleases.length) {
      return null;
    }

    const tagsResult: ReleaseResult = {
      sourceUrl: getSourceUrl(config.packageName, config.registryUrl),
      releases: tagReleases.map((item) => ({ ...item, gitRef: item.version })),
    };

    try {
      // Fetch additional data from releases endpoint when possible
      const releasesResult = await super.getReleases(config);
      type PartialRelease = Omit<Release, 'version'>;

      const releaseByVersion: Record<string, PartialRelease> = {};
      releasesResult?.releases?.forEach((release) => {
        const { version, ...value } = release;
        releaseByVersion[version] = value;
      });

      const mergedReleases: Release[] = [];
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

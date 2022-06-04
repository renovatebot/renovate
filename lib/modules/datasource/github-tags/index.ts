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
      ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        this.getTagCommit(registryUrl, repo!, newValue)
      : // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        this.getCommit(registryUrl, repo!);
  }

  override async getReleases(
    config: GetReleasesConfig
  ): Promise<ReleaseResult> {
    const tagReleases = await this.tagsCache.getItems(config);

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
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, `Error fetching additional info for GitHub tags`);
    }

    return tagsResult;
  }
}

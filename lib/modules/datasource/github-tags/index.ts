import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { queryReleases, queryTags } from '../../../util/github/graphql';
import type { GithubReleaseItem } from '../../../util/github/graphql/types';
import { findCommitOfTag } from '../../../util/github/tags';
import { getApiBaseUrl, getSourceUrl } from '../../../util/github/url';
import { GithubHttp } from '../../../util/http/github';
import { Datasource } from '../datasource';
import type {
  DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types';

export class GithubTagsDatasource extends Datasource {
  static readonly id = 'github-tags';

  override readonly defaultRegistryUrls = ['https://github.com'];

  override readonly registryStrategy = 'hunt';

  override http: GithubHttp;

  constructor() {
    super(GithubTagsDatasource.id);
    this.http = new GithubHttp(GithubTagsDatasource.id);
  }

  async getCommit(
    registryUrl: string | undefined,
    githubRepo: string,
  ): Promise<string | null> {
    const apiBaseUrl = getApiBaseUrl(registryUrl);
    let digest: string | null = null;
    try {
      const url = `${apiBaseUrl}repos/${githubRepo}/commits?per_page=1`;
      const res = await this.http.getJson<{ sha: string }[]>(url);
      digest = res.body[0].sha;
    } catch (err) {
      logger.debug(
        { githubRepo, err, registryUrl },
        'Error getting latest commit from GitHub repo',
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
    newValue?: string,
  ): Promise<string | null> {
    return newValue
      ? findCommitOfTag(registryUrl, repo!, newValue, this.http)
      : this.getCommit(registryUrl, repo!);
  }

  override async getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult> {
    const { registryUrl, packageName: repo } = config;
    const sourceUrl = getSourceUrl(repo, registryUrl);
    const tagsResult = await queryTags(config, this.http);
    const releases: Release[] = tagsResult.map(
      ({ version, releaseTimestamp, gitRef, hash }) => ({
        newDigest: hash,
        version,
        releaseTimestamp,
        gitRef,
      }),
    );

    try {
      // Fetch additional data from releases endpoint when possible
      const releasesResult = await queryReleases(config, this.http);
      const releasesMap = new Map<string, GithubReleaseItem>();
      for (const release of releasesResult) {
        releasesMap.set(release.version, release);
      }

      for (const release of releases) {
        const isReleaseStable = releasesMap.get(release.version)?.isStable;
        if (is.boolean(isReleaseStable)) {
          release.isStable = isReleaseStable;
        }
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, `Error fetching additional info for GitHub tags`);
    }

    const dependency: ReleaseResult = {
      sourceUrl,
      releases,
    };
    return dependency;
  }
}

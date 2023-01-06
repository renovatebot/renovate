import { logger } from '../../../logger';
import { queryTags } from '../../../util/github/graphql';
import { getApiBaseUrl, getSourceUrl } from '../../../util/github/url';
import { GithubHttp } from '../../../util/http/github';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';

export class GithubTagsDatasource extends Datasource {
  static readonly id = 'github-tags';

  override readonly defaultRegistryUrls = ['https://github.com'];

  override http: GithubHttp;

  constructor() {
    super(GithubTagsDatasource.id);
    this.http = new GithubHttp(GithubTagsDatasource.id);
  }

  async getTagCommit(
    registryUrl: string | undefined,
    packageName: string,
    tag: string
  ): Promise<string | null> {
    try {
      const tags = await queryTags({ packageName, registryUrl }, this.http);
      const tagItem = tags.find(({ version }) => version === tag);
      if (tagItem) {
        return tagItem.hash;
      }
    } catch (err) {
      logger.debug(
        { githubRepo: packageName, err },
        'Error getting tag commit from GitHub repo'
      );
    }
    return null;
  }

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
        { githubRepo, err, registryUrl },
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

  override async getReleases(
    config: GetReleasesConfig
  ): Promise<ReleaseResult> {
    const { registryUrl, packageName: repo } = config;
    const sourceUrl = getSourceUrl(repo, registryUrl);
    const tags = await queryTags(config, this.http);
    const releases = tags.map(({ version, releaseTimestamp, gitRef }) => ({
      version,
      releaseTimestamp,
      gitRef,
    }));
    const dependency: ReleaseResult = { sourceUrl, releases };
    return dependency;
  }
}

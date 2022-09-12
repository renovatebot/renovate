import { logger } from '../../../logger';
import type { GithubRestRef, GithubRestTag } from '../../../util/github/types';
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
    githubRepo: string,
    tag: string
  ): Promise<string | null> {
    const apiBaseUrl = getApiBaseUrl(registryUrl);
    let digest: string | null = null;
    try {
      const url = `${apiBaseUrl}repos/${githubRepo}/git/refs/tags/${tag}`;
      const res = (await this.http.getJson<GithubRestRef>(url)).body.object;
      if (res.type === 'commit') {
        digest = res.sha;
      } else if (res.type === 'tag') {
        digest = (await this.http.getJson<GithubRestRef>(res.url)).body.object
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

  override async getReleases(
    config: GetReleasesConfig
  ): Promise<ReleaseResult> {
    const { registryUrl, packageName: repo } = config;
    const apiBaseUrl = getApiBaseUrl(registryUrl);
    // tag
    const url = `${apiBaseUrl}repos/${repo}/tags?per_page=100`;

    const versions = (
      await this.http.getJson<GithubRestTag[]>(url, {
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
}

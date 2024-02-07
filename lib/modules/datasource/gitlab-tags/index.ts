import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { GitlabHttp } from '../../../util/http/gitlab';
import { joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import type { GitlabCommit, GitlabTag } from './types';
import { defaultRegistryUrl, getDepHost, getSourceUrl } from './util';

export class GitlabTagsDatasource extends Datasource {
  static readonly id = 'gitlab-tags';

  protected override http: GitlabHttp;

  constructor() {
    super(GitlabTagsDatasource.id);
    this.http = new GitlabHttp(GitlabTagsDatasource.id);
  }

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  @cache({
    namespace: `datasource-${GitlabTagsDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${getDepHost(registryUrl)}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const depHost = getDepHost(registryUrl);

    const urlEncodedRepo = encodeURIComponent(repo);

    // tag
    const url = joinUrlParts(
      depHost,
      `api/v4/projects`,
      urlEncodedRepo,
      `repository/tags?per_page=100`,
    );

    const gitlabTags = (
      await this.http.getJson<GitlabTag[]>(url, {
        paginate: true,
      })
    ).body;

    const dependency: ReleaseResult = {
      sourceUrl: getSourceUrl(repo, registryUrl),
      releases: [],
    };
    dependency.releases = gitlabTags.map(({ name, commit }) => ({
      version: name,
      gitRef: name,
      releaseTimestamp: commit?.created_at,
    }));

    return dependency;
  }

  /**
   * gitlab.getDigest
   *
   * Returs the latest commit hash of the repository.
   */
  @cache({
    namespace: `datasource-${GitlabTagsDatasource.id}-commit`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${getDepHost(registryUrl)}:${packageName}`,
  })
  override async getDigest(
    { packageName: repo, registryUrl }: Partial<DigestConfig>,
    newValue?: string,
  ): Promise<string | null> {
    const depHost = getDepHost(registryUrl);

    const urlEncodedRepo = encodeURIComponent(repo!);
    let digest: string | null = null;

    try {
      if (newValue) {
        const url = joinUrlParts(
          depHost,
          `api/v4/projects`,
          urlEncodedRepo,
          `repository/commits/`,
          newValue,
        );
        const gitlabCommits = await this.http.getJson<GitlabCommit>(url);
        digest = gitlabCommits.body.id;
      } else {
        const url = joinUrlParts(
          depHost,
          `api/v4/projects`,
          urlEncodedRepo,
          `repository/commits?per_page=1`,
        );
        const gitlabCommits = await this.http.getJson<GitlabCommit[]>(url);
        digest = gitlabCommits.body[0].id;
      }
    } catch (err) {
      logger.debug(
        { gitlabRepo: repo, err, registryUrl },
        'Error getting latest commit from Gitlab repo',
      );
    }

    if (!digest) {
      return null;
    }

    return digest;
  }
}

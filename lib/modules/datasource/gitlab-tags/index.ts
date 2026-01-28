import { logger } from '../../../logger/index.ts';
import { cache } from '../../../util/cache/package/decorator.ts';
import { GitlabHttp } from '../../../util/http/gitlab.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import type { GitlabCommit, GitlabTag } from './types.ts';
import { defaultRegistryUrl, getDepHost, getSourceUrl } from './util.ts';

export class GitlabTagsDatasource extends Datasource {
  static readonly id = 'gitlab-tags';

  protected override http: GitlabHttp;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'To get release timestamp we use the `created_at` field from the response.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  constructor() {
    super(GitlabTagsDatasource.id);
    this.http = new GitlabHttp(GitlabTagsDatasource.id);
  }

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  @cache({
    namespace: `datasource-${GitlabTagsDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `getReleases:${getDepHost(registryUrl)}:${packageName}`,
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
      await this.http.getJsonUnchecked<GitlabTag[]>(url, {
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
      releaseTimestamp: asTimestamp(commit?.created_at),
    }));

    return dependency;
  }

  /**
   * gitlab.getDigest
   *
   * Returs the latest commit hash of the repository.
   */
  @cache({
    namespace: `datasource-${GitlabTagsDatasource.id}`,
    key: ({ registryUrl, packageName }: DigestConfig) =>
      `getDigest:${getDepHost(registryUrl)}:${packageName}`,
  })
  override async getDigest(
    { packageName: repo, registryUrl }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const depHost = getDepHost(registryUrl);

    const urlEncodedRepo = encodeURIComponent(repo);
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
        const gitlabCommits =
          await this.http.getJsonUnchecked<GitlabCommit>(url);
        digest = gitlabCommits.body.id;
      } else {
        const url = joinUrlParts(
          depHost,
          `api/v4/projects`,
          urlEncodedRepo,
          `repository/commits?per_page=1`,
        );
        const gitlabCommits =
          await this.http.getJsonUnchecked<GitlabCommit[]>(url);
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

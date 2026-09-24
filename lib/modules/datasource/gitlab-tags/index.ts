import { logger } from '../../../logger/index.ts';
import { GitlabHttp } from '../../../util/http/gitlab.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type {
  RegistryDigestConfig,
  RegistryGetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import { GitlabCommit, GitlabCommits, GitlabTags } from './schema.ts';
import { defaultRegistryUrl, getDepHost, getSourceUrl } from './util.ts';

export class GitlabTagsDatasource extends Datasource<GitlabHttp> {
  static readonly id = 'gitlab-tags';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'To get release timestamp we use the `created_at` field from the response.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  constructor() {
    super(GitlabTagsDatasource.id, new GitlabHttp(GitlabTagsDatasource.id));
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return [defaultRegistryUrl];
  }

  private async fetchReleases({
    registryUrl,
    packageName: repo,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
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
      await this.http.getJson(url, { paginate: true }, GitlabTags)
    ).body;

    const dependency: ReleaseResult = {
      sourceUrl: getSourceUrl(repo, registryUrl),
      releases: [],
    };
    dependency.releases = gitlabTags.map(({ name, commit }) => ({
      version: name,
      gitRef: name,
      releaseTimestamp: asTimestamp(commit.created_at),
    }));

    return dependency;
  }

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: `getReleases:${getDepHost(config.registryUrl)}:${config.packageName}`,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }

  /**
   * gitlab.getDigest
   *
   * Returs the latest commit hash of the repository.
   */
  private async fetchDigest(
    { packageName: repo, registryUrl }: RegistryDigestConfig,
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
        const gitlabCommit = await this.http.getJson(url, GitlabCommit);
        digest = gitlabCommit.body.id;
      } else {
        const url = joinUrlParts(
          depHost,
          `api/v4/projects`,
          urlEncodedRepo,
          `repository/commits?per_page=1`,
        );
        const gitlabCommits = await this.http.getJson(url, GitlabCommits);
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

  override getDigest(
    config: RegistryDigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    return this.cached(
      {
        key: `getDigest:${getDepHost(config.registryUrl)}:${config.packageName}`,
        fallback: true,
      },
      () => this.fetchDigest(config, newValue),
    );
  }
}

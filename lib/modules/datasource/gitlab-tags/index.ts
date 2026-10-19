import { logger } from '../../../logger/index.ts';
import {
  defaultRegistryUrl,
  getApiBaseUrl,
  getDepHost,
  getSourceUrl,
} from '../../../util/gitlab/url.ts';
import { GitlabHttp } from '../../../util/http/gitlab.ts';
import { HttpError } from '../../../util/http/index.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { GitHostTagsDigestDatasource } from '../git-host-tags.ts';
import type { DigestConfig, GetReleasesConfig, GitHostTag } from '../types.ts';
import { GitlabCommit, GitlabCommits, GitlabTags } from './schema.ts';

export class GitlabTagsDatasource extends GitHostTagsDigestDatasource<GitlabHttp> {
  static readonly id = 'gitlab-tags';

  protected getSourceUrl(packageName: string, registryUrl?: string): string {
    return getSourceUrl(packageName, registryUrl);
  }

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

  /** Strips the `/api/v4` suffix, so both spellings share a cache key. */
  protected override getRegistryUrl(registryUrl?: string): string {
    return getDepHost(registryUrl);
  }

  protected async fetchTags({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<GitHostTag[]> {
    const apiBaseUrl = getApiBaseUrl(registryUrl);

    const urlEncodedRepo = encodeURIComponent(repo);

    // tag
    const url = joinUrlParts(
      apiBaseUrl,
      `projects`,
      urlEncodedRepo,
      `repository/tags?per_page=100`,
    );

    const gitlabTags = (
      await this.http.getJson(url, { paginate: true }, GitlabTags)
    ).body;

    return gitlabTags.map(({ name, commit }) => ({
      version: name,
      releaseTimestamp: asTimestamp(commit.created_at),
    }));
  }

  protected async fetchTagCommit(
    registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    const url = joinUrlParts(
      getApiBaseUrl(registryUrl),
      `projects`,
      encodeURIComponent(repo),
      `repository/commits/`,
      encodeURIComponent(tag),
    );
    const gitlabCommit = await this.http.getJson(url, GitlabCommit);
    return gitlabCommit.body.id;
  }

  protected async fetchLatestCommit(
    registryUrl: string | undefined,
    repo: string,
  ): Promise<string | null> {
    const url = joinUrlParts(
      getApiBaseUrl(registryUrl),
      `projects`,
      encodeURIComponent(repo),
      `repository/commits?per_page=1`,
    );
    const gitlabCommits = await this.http.getJson(url, GitlabCommits);
    return gitlabCommits.body[0]?.id ?? null;
  }

  protected override async fetchDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    try {
      return await super.fetchDigest(config, newValue);
    } catch (err) {
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        logger.debug(
          {
            gitlabRepo: config.packageName,
            err,
            registryUrl: config.registryUrl,
          },
          'Gitlab repo or ref not found when getting commit',
        );
        return null;
      }
      this.handleGenericErrors(err);
    }
  }
}

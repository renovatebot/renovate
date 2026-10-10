import { isBoolean, isNullOrUndefined } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import {
  queryReleases,
  queryTags,
} from '../../../util/github/graphql/index.ts';
import type { GithubReleaseItem } from '../../../util/github/graphql/types.ts';
import { findCommitOfTag } from '../../../util/github/tags.ts';
import { getApiBaseUrl, getSourceUrl } from '../../../util/github/url.ts';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider.ts';
import { GithubHttp } from '../../../util/http/github.ts';
import { GitHostTagsDigestDatasource } from '../git-host-tags.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  GitHostTag,
  ReleaseResult,
} from '../types.ts';

export class GithubTagsDatasource extends GitHostTagsDigestDatasource<GithubHttp> {
  static readonly id = 'github-tags';

  /**
   * Browser URL of the repository `packageName` on `registryUrl`, or on the
   * default registry.
   */
  protected getSourceUrl(packageName: string, registryUrl?: string): string {
    return getSourceUrl(packageName, registryUrl);
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return ['https://github.com'];
  }

  override readonly registryStrategy = 'hunt';

  override readonly releaseTimestampSupport = true;
  // Note: not sure
  override readonly releaseTimestampNote =
    'The get release timestamp is determined from the `releaseTimestamp` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  constructor() {
    super(GithubTagsDatasource.id, new GithubHttp(GithubTagsDatasource.id));
  }

  protected getRegistryUrl(registryUrl?: string): string {
    return registryUrl ?? this.getDefaultRegistryUrls('')[0];
  }

  protected fetchTagCommit(
    registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    return findCommitOfTag(registryUrl, repo, tag, this.http);
  }

  protected async fetchLatestCommit(
    registryUrl: string | undefined,
    githubRepo: string,
  ): Promise<string | null> {
    const apiBaseUrl = getApiBaseUrl(registryUrl);
    let digest: string | null = null;
    try {
      const url = `${apiBaseUrl}repos/${githubRepo}/commits?per_page=1`;
      const res = await this.http.getJsonUnchecked<{ sha: string }[]>(url, {
        cacheProvider: memCacheProvider,
      });
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
    { packageName: repo, registryUrl }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    if (newValue) {
      return this.fetchTagCommit(registryUrl, repo, newValue);
    }

    return this.fetchLatestCommit(registryUrl, repo);
  }

  /**
   * The GraphQL fetcher caches the tags and releases itself, so the result
   * skips the package cache of the base class.
   */
  override getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return this.fetchReleases(config);
  }

  protected async fetchTags(config: GetReleasesConfig): Promise<GitHostTag[]> {
    const tagsResult = await queryTags(config, this.http);
    const releases: GitHostTag[] = tagsResult.map(
      ({ version, releaseTimestamp, hash }) => ({
        newDigest: hash,
        version,
        releaseTimestamp,
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
        if (isBoolean(isReleaseStable)) {
          release.isStable = isReleaseStable;
        }

        const releaseTimestamp = releasesMap.get(
          release.version,
        )?.releaseTimestamp;
        if (
          releaseTimestamp &&
          (isNullOrUndefined(release.releaseTimestamp) ||
            releaseTimestamp > release.releaseTimestamp)
        ) {
          release.releaseTimestamp = releaseTimestamp;
        }
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, `Error fetching additional info for GitHub tags`);
    }

    return releases;
  }
}

import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { queryReleases } from '../../../util/github/graphql';
import { findCommitOfTag } from '../../../util/github/tags';
import { getSourceUrl } from '../../../util/github/url';
import { GithubHttp } from '../../../util/http/github';
import { Datasource } from '../datasource';
import type {
  DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types';

export const cacheNamespace = 'datasource-github-releases';

export class GithubReleasesDatasource extends Datasource {
  static readonly id = 'github-releases';

  override readonly defaultRegistryUrls = ['https://github.com'];

  override http: GithubHttp;

  constructor() {
    super(GithubReleasesDatasource.id);
    this.http = new GithubHttp(GithubReleasesDatasource.id);
  }

  /**
   * Attempts to resolve the digest for the specified package.
   *
   * The `newValue` supplied here should be a valid tag for the GitHub release. The digest
   * of a GitHub release will be the underlying SHA of the release tag.
   *
   * Some managers like Bazel will deal with individual artifacts from releases and handle
   * the artifact checksum computation separately. This data-source does not know about
   * specific artifacts being used, as that could vary per manager
   */
  override getDigest(
    {
      packageName: repo,
      currentValue,
      currentDigest,
      registryUrl,
    }: DigestConfig,
    newValue: string,
  ): Promise<string | null> {
    logger.debug(
      { repo, currentValue, currentDigest, registryUrl, newValue },
      'getDigest',
    );

    return findCommitOfTag(registryUrl, repo, newValue, this.http);
  }

  /**
   * This function can be used to fetch releases with a customizable versioning
   * (e.g. semver) and with releases.
   *
   * This function will:
   *  - Fetch all releases
   *  - Sanitize the versions if desired (e.g. strip out leading 'v')
   *  - Return a dependency object containing sourceUrl string and releases array
   */
  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult> {
    const releasesResult = await queryReleases(config, this.http);
    const releases = releasesResult.map((item) => {
      const { version, releaseTimestamp, isStable } = item;
      const result: Release = {
        version,
        gitRef: version,
        releaseTimestamp,
      };
      if (is.boolean(isStable)) {
        result.isStable = isStable;
      }
      return result;
    });
    const sourceUrl = getSourceUrl(config.packageName, config.registryUrl);
    return { sourceUrl, releases };
  }
}

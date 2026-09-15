import { isBoolean } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { queryReleases } from '../../../util/github/graphql/index.ts';
import { findCommitOfTag } from '../../../util/github/tags.ts';
import { getSourceUrl } from '../../../util/github/url.ts';
import { GithubHttp } from '../../../util/http/github.ts';
import { Datasource } from '../datasource.ts';
import type {
  RegistryDigestConfig,
  RegistryGetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';

export class GithubReleasesDatasource extends Datasource<GithubHttp> {
  static id = 'github-releases';

  override readonly defaultRegistryUrls = ['https://github.com'];

  override readonly releaseTimestampSupport = true;
  // Note: not sure
  override readonly releaseTimestampNote: string =
    'The release timestamp is determined from the `releaseTimestamp` field from the response.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  /**
   * A subclass with a different `id` (currently only
   * `GithubReleaseAttachmentsDatasource`) passes it through here so the base
   * constructor builds its own `GithubHttp` client keyed to that `id`.
   */
  constructor(id: string = GithubReleasesDatasource.id) {
    super(id, new GithubHttp(id));
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
    }: RegistryDigestConfig,
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
  async getReleases(config: RegistryGetReleasesConfig): Promise<ReleaseResult> {
    const releasesResult = await queryReleases(config, this.http);
    const releases = releasesResult.map((item) => {
      const { version, releaseTimestamp, isStable } = item;
      const result: Release = {
        version,
        gitRef: version,
        releaseTimestamp,
      };
      if (isBoolean(isStable)) {
        result.isStable = isStable;
      }
      return result;
    });
    const sourceUrl = getSourceUrl(config.packageName, config.registryUrl);
    return { sourceUrl, releases };
  }
}

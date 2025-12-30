import { cache } from '../../../util/cache/package/decorator';
import { queryBranches, queryTags } from '../../../util/github/graphql';
import { getSourceUrl } from '../../../util/github/url';
import { GithubHttp } from '../../../util/http/github';
import * as exactVersioning from '../../versioning/exact';
import { Datasource } from '../datasource';
import type {
  DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types';

export class GithubDigestDatasource extends Datasource {
  static readonly id = 'github-digest';

  override readonly defaultRegistryUrls = ['https://github.com'];

  override readonly registryStrategy = 'hunt';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the commit date.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  override readonly defaultVersioning = exactVersioning.id;

  override http: GithubHttp;

  constructor() {
    super(GithubDigestDatasource.id);
    this.http = new GithubHttp(GithubDigestDatasource.id);
  }

  @cache({
    namespace: `datasource-${GithubDigestDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `getReleases:${registryUrl}:${packageName}`,
  })
  override async getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult> {
    const { registryUrl, packageName: repo } = config;
    const sourceUrl = getSourceUrl(repo, registryUrl);

    const [tagsResult, branchesResult] = await Promise.all([
      queryTags(config, this.http),
      queryBranches(config, this.http),
    ]);

    // Tags take priority over branches when names conflict
    const releases: Release[] = tagsResult.map(
      ({ version, releaseTimestamp, gitRef, hash }) => ({
        version,
        releaseTimestamp,
        gitRef,
        newDigest: hash,
      }),
    );
    const tagVersions = new Set(tagsResult.map((t) => t.version));
    for (const { version, releaseTimestamp, gitRef, hash } of branchesResult) {
      if (!tagVersions.has(version)) {
        releases.push({
          version,
          releaseTimestamp,
          gitRef,
          newDigest: hash,
        });
      }
    }

    return {
      sourceUrl,
      releases,
    };
  }

  @cache({
    namespace: `datasource-${GithubDigestDatasource.id}`,
    key: ({ registryUrl, packageName }: DigestConfig, newValue?: string) =>
      `getDigest:${registryUrl}:${packageName}:${newValue}`,
  })
  override async getDigest(
    { packageName: repo, registryUrl }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    if (!newValue) {
      return null;
    }

    const config = { packageName: repo, registryUrl };

    // Tags take priority over branches
    const tags = await queryTags(config, this.http);
    const tagItem = tags.find(({ version }) => version === newValue);
    if (tagItem?.hash) {
      return tagItem.hash;
    }

    const branches = await queryBranches(config, this.http);
    const branchItem = branches.find(({ version }) => version === newValue);
    if (branchItem?.hash) {
      return branchItem.hash;
    }

    return null;
  }
}

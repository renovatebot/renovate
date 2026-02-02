import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import {
  queryBranches,
  queryTags,
} from '../../../util/github/graphql/index.ts';
import { getSourceUrl } from '../../../util/github/url.ts';
import { GithubHttp } from '../../../util/http/github.ts';
import * as exactVersioning from '../../versioning/exact/index.ts';
import { Datasource } from '../datasource.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';

export class GithubDigestDatasource extends Datasource {
  static readonly id = 'github-digest';

  private static readonly cacheNamespace: PackageCacheNamespace = `datasource-${GithubDigestDatasource.id}`;

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

  private static getCacheKey(
    registryUrl: string | undefined,
    packageName: string,
    suffix: string,
  ): string {
    return `${registryUrl}:${packageName}:${suffix}`;
  }

  override getReleases(config: GetReleasesConfig): Promise<ReleaseResult> {
    const { registryUrl, packageName: repo } = config;
    const sourceUrl = getSourceUrl(repo, registryUrl);

    return withCache(
      {
        namespace: GithubDigestDatasource.cacheNamespace,
        key: GithubDigestDatasource.getCacheKey(registryUrl, repo, 'releases'),
      },
      async () => {
        const [tagsSettled, branchesSettled] = await Promise.allSettled([
          queryTags(config, this.http),
          queryBranches(config, this.http),
        ]);

        if (tagsSettled.status === 'rejected') {
          throw tagsSettled.reason;
        }
        if (branchesSettled.status === 'rejected') {
          throw branchesSettled.reason;
        }

        const tagsResult = tagsSettled.value;
        const branchesResult = branchesSettled.value;

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
        for (const {
          version,
          releaseTimestamp,
          gitRef,
          hash,
        } of branchesResult) {
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
      },
    );
  }

  override async getDigest(
    { packageName: repo, registryUrl }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    if (!newValue) {
      return null;
    }

    return await withCache(
      {
        namespace: GithubDigestDatasource.cacheNamespace,
        key: GithubDigestDatasource.getCacheKey(
          registryUrl,
          repo,
          `digest:${newValue}`,
        ),
      },
      async () => {
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
      },
    );
  }
}

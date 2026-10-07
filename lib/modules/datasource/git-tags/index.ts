import { logger } from '../../../logger/index.ts';
import { GitDatasource } from '../git-refs/base.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import { resolvePlatformTagsLookup } from './platforms.ts';
import type { PlatformTagsLookup } from './types.ts';

export class GitTagsDatasource extends GitDatasource {
  static override readonly id = 'git-tags';

  constructor() {
    super(GitTagsDatasource.id);
  }

  protected override readonly refTypes = ['tags'];

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: config.packageName,
        fallback: true,
      },
      () => this.getTagReleases(config),
    );
  }

  /**
   * The tags of a repository on a known git hosting platform come from the
   * platform's API, through its `*-tags` datasource: that lookup authenticates
   * with the platform's host rules and knows the release timestamps. Every
   * other host, and a platform whose API lookup fails or finds nothing, is
   * read with `git ls-remote`.
   */
  private async getTagReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const platform = resolvePlatformTagsLookup(config.packageName);
    if (platform) {
      const res = await this.viaPlatform(platform, () =>
        platform.datasource.getReleases({
          ...config,
          registryUrl: platform.registryUrl,
          packageName: platform.packageName,
        }),
      );
      if (res) {
        return { ...res, effectiveDatasource: platform.id };
      }
    }

    return this.getRefReleases(config);
  }

  override async getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const platform = resolvePlatformTagsLookup(config.packageName);
    if (platform) {
      const digest = await this.viaPlatform(platform, () =>
        platform.datasource.getDigest(
          {
            ...config,
            registryUrl: platform.registryUrl,
            packageName: platform.packageName,
          },
          newValue,
        ),
      );
      if (digest) {
        return digest;
      }
    }

    return super.getDigest(config, newValue);
  }

  /**
   * Runs a lookup against the platform API and turns its failure into a miss,
   * so that `git ls-remote` still answers: it needs no API token, and a rate
   * limit on the API says nothing about the repository.
   */
  private async viaPlatform<T>(
    { id, packageName }: PlatformTagsLookup,
    lookup: () => Promise<T | null>,
  ): Promise<T | null> {
    try {
      return await lookup();
    } catch (err) {
      logger.debug(
        { err, datasource: id, packageName },
        'git-tags: platform API lookup failed, falling back to git ls-remote',
      );
      return null;
    }
  }
}

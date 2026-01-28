import { withCache } from '../../../util/cache/package/with-cache.ts';
import { regEx } from '../../../util/regex.ts';
import { GitDatasource } from '../git-refs/base.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';

export class GitTagsDatasource extends GitDatasource {
  static override readonly id = 'git-tags';

  constructor() {
    super(GitTagsDatasource.id);
  }

  override readonly customRegistrySupport = false;
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  private async _getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const rawRefs = await this.getRawRefs({ packageName });

    if (rawRefs === null) {
      return null;
    }
    const releases = rawRefs
      .filter((ref) => ref.type === 'tags')
      .map((ref) => ({
        version: ref.value,
        gitRef: ref.value,
        newDigest: ref.hash,
      }));

    const sourceUrl = packageName
      .replace(regEx(/\.git$/), '')
      .replace(regEx(/\/$/), '');

    const result: ReleaseResult = {
      sourceUrl,
      releases,
    };

    return result;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${GitTagsDatasource.id}`,
        key: config.packageName,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  override async getDigest(
    { packageName }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const rawRefs = await this.getRawRefs({ packageName });
    const findValue = newValue ?? 'HEAD';
    const ref = rawRefs?.find((rawRef) => rawRef.value === findValue);
    if (ref) {
      return ref.hash;
    }
    return null;
  }
}

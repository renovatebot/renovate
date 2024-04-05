import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { GitDatasource } from '../git-refs/base';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';

export class GitTagsDatasource extends GitDatasource {
  static override readonly id = 'git-tags';

  constructor() {
    super(GitTagsDatasource.id);
  }

  override readonly customRegistrySupport = false;

  @cache({
    namespace: `datasource-${GitTagsDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  async getReleases({
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

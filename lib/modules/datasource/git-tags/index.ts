import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { GitDatasource, GitError } from '../git-refs/base';
import type { RawRefs } from '../git-refs/types';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { ExternalHostError } from '../../../types/errors/external-host-error';

export class GitTagsDatasource extends GitDatasource {
  static override readonly id = 'git-tags';

  constructor() {
    super(GitTagsDatasource.id);
  }

  override readonly customRegistrySupport = false;
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  @cache({
    namespace: `datasource-${GitTagsDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  async getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    let rawRefs: RawRefs[] | null = null;

    try {
      rawRefs = await this.getRawRefs({ packageName });
    } catch (err) {
      if (err instanceof GitError) {
        throw new ExternalHostError(err);
      }

      throw err;
    }

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
    let rawRefs: RawRefs[] | null = null;

    try {
      rawRefs = await this.getRawRefs({ packageName });
    } catch (err) {
      if (err instanceof GitError) {
        throw new ExternalHostError(err);
      }

      throw err;
    }

    const findValue = newValue ?? 'HEAD';
    const ref = rawRefs?.find((rawRef) => rawRef.value === findValue);
    if (ref) {
      return ref.hash;
    }
    return null;
  }
}

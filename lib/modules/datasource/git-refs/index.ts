import { logger } from '../../../logger';
import { cached } from '../../../util/cache/package/cached';
import { regEx } from '../../../util/regex';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { GitDatasource } from './base';
import type { RawRefs } from './types';

// git will prompt for known hosts or passwords, unless we activate BatchMode
process.env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';

export class GitRefsDatasource extends GitDatasource {
  static override readonly id = 'git-refs';

  constructor() {
    super(GitRefsDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  private async _getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    let rawRefs: RawRefs[] | null = null;

    try {
      rawRefs = await this.getRawRefs({ packageName });
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, 'Error getting git-refs');
    }

    if (!rawRefs) {
      return null;
    }

    const refs = rawRefs
      .filter((ref) => ref.type === 'tags' || ref.type === 'heads')
      .map((ref) => ref.value);

    const uniqueRefs = [...new Set(refs)];

    const sourceUrl = packageName
      .replace(regEx(/\.git$/), '')
      .replace(regEx(/\/$/), '');

    const result: ReleaseResult = {
      sourceUrl,
      releases: uniqueRefs.map((ref) => ({
        version: ref,
        gitRef: ref,
        newDigest: rawRefs.find((rawRef) => rawRef.value === ref)?.hash,
      })),
    };

    return result;
  }

  override getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return cached(
      {
        namespace: `datasource-${GitRefsDatasource.id}`,
        key: config.packageName,
      },
      () => this._getReleases(config),
    );
  }

  override async getDigest(
    { packageName }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const rawRefs: RawRefs[] | null = await this.getRawRefs({ packageName });

    /* v8 ignore next 3 -- TODO: add test */
    if (!rawRefs) {
      return null;
    }

    let ref: RawRefs | undefined;
    if (newValue) {
      ref = rawRefs.find(
        (rawRef) =>
          ['heads', 'tags'].includes(rawRef.type) && rawRef.value === newValue,
      );
    } else {
      ref = rawRefs.find(
        (rawRef) => rawRef.type === '' && rawRef.value === 'HEAD',
      );
    }
    if (ref) {
      return ref.hash;
    }
    return null;
  }
}

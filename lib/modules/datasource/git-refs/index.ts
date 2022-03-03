import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { GitDatasource } from './base';
import type { RawRefs } from './types';

// git will prompt for known hosts or passwords, unless we activate BatchMode
process.env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';

export class GitRefsDatasource extends Datasource {
  static readonly id = 'git-refs';

  constructor() {
    super(GitRefsDatasource.id);
  }

  override readonly customRegistrySupport = false;

  @cache({
    namespace: `datasource-${GitRefsDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  override async getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const rawRefs: RawRefs[] = await GitDatasource.getRawRefs(
      { packageName },
      this.id
    );

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
        newDigest: rawRefs.find((rawRef) => rawRef.value === ref).hash,
      })),
    };

    return result;
  }

  override async getDigest(
    { packageName }: DigestConfig,
    newValue?: string
  ): Promise<string | null> {
    const rawRefs: RawRefs[] = await GitDatasource.getRawRefs(
      { packageName },
      this.id
    );
    let ref: RawRefs;
    if (newValue) {
      ref = rawRefs.find(
        (rawRef) =>
          ['heads', 'tags'].includes(rawRef.type) && rawRef.value === newValue
      );
    } else {
      ref = rawRefs.find(
        (rawRef) => rawRef.type === '' && rawRef.value === 'HEAD'
      );
    }
    if (ref) {
      return ref.hash;
    }
    return null;
  }
}

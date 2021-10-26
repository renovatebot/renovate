import { cache } from '../../util/cache/package/decorator';
import { regEx } from '../../util/regex';
import * as semver from '../../versioning/semver';
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
    key: ({ lookupName }: GetReleasesConfig) => lookupName,
  })
  // eslint-disable-next-line class-methods-use-this
  override async getReleases({
    lookupName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const rawRefs: RawRefs[] = await GitDatasource.getRawRefs(
      { lookupName },
      this.id
    );

    const refs = rawRefs
      .filter((ref) => ref.type === 'tags' || ref.type === 'heads')
      .map((ref) => ref.value)
      .filter((ref) => semver.isVersion(ref));

    const uniqueRefs = [...new Set(refs)];

    const sourceUrl = lookupName
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

  // eslint-disable-next-line class-methods-use-this
  override async getDigest(
    { lookupName }: DigestConfig,
    newValue?: string
  ): Promise<string | null> {
    const rawRefs: RawRefs[] = await GitDatasource.getRawRefs(
      { lookupName },
      this.id
    );
    const findValue = newValue || 'HEAD';
    const ref = rawRefs.find((rawRef) => rawRef.value === findValue);
    if (ref) {
      return ref.hash;
    }
    return null;
  }
}

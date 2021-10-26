import { cache } from '../../util/cache/package/decorator';
import { regEx } from '../../util/regex';
import * as semver from '../../versioning/semver';
import { Datasource } from '../datasource';
import { GitDatasource } from '../git-refs/base';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';

export class GitTagsDatasource extends Datasource {
  static readonly id = 'git-tags';

  constructor() {
    super(GitTagsDatasource.id);
  }

  override readonly customRegistrySupport = false;

  @cache({
    namespace: `datasource-${GitTagsDatasource.id}`,
    key: ({ lookupName }: GetReleasesConfig) => lookupName,
  })
  // eslint-disable-next-line class-methods-use-this
  async getReleases({
    lookupName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const rawRefs = await GitDatasource.getRawRefs({ lookupName }, this.id);

    if (rawRefs === null) {
      return null;
    }
    const releases = rawRefs
      .filter((ref) => ref.type === 'tags')
      .filter((ref) => semver.isVersion(ref.value))
      .map((ref) => ({
        version: ref.value,
        gitRef: ref.value,
        newDigest: ref.hash,
      }));

    const sourceUrl = lookupName
      .replace(regEx(/\.git$/), '')
      .replace(regEx(/\/$/), '');

    const result: ReleaseResult = {
      sourceUrl,
      releases,
    };

    return result;
  }

  // eslint-disable-next-line class-methods-use-this
  override async getDigest(
    { lookupName }: DigestConfig,
    newValue?: string
  ): Promise<string | null> {
    const rawRefs = await GitDatasource.getRawRefs({ lookupName }, this.id);
    const findValue = newValue || 'HEAD';
    const ref = rawRefs.find((rawRef) => rawRef.value === findValue);
    if (ref) {
      return ref.hash;
    }
    return null;
  }
}

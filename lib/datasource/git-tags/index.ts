import * as semver from '../../versioning/semver';
import * as gitRefs from '../git-refs';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'git-tags';
export const customRegistrySupport = false;

export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const rawRefs: gitRefs.RawRefs[] = await gitRefs.getRawRefs({ lookupName });

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

  const sourceUrl = lookupName.replace(/\.git$/, '').replace(/\/$/, '');

  const result: ReleaseResult = {
    sourceUrl,
    releases,
  };

  return result;
}

export async function getDigest(
  { lookupName }: Partial<DigestConfig>,
  newValue?: string
): Promise<string | null> {
  const rawRefs: gitRefs.RawRefs[] = await gitRefs.getRawRefs({ lookupName });
  const findValue = newValue || 'HEAD';
  const ref = rawRefs.find((rawRef) => rawRef.value === findValue);
  if (ref) {
    return ref.hash;
  }
  return null;
}

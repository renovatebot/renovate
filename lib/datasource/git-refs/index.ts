import simpleGit from 'simple-git/promise';
import * as semver from '../../versioning/semver';
import { logger } from '../../logger';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'git-refs';

const cacheMinutes = 10;

// git will prompt for known hosts or passwords, unless we activate BatchMode
process.env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';

export interface RawRefs {
  type: string;
  value: string;
}

export async function getRawRefs({
  lookupName,
}: GetReleasesConfig): Promise<RawRefs[] | null> {
  const git = simpleGit();
  try {
    const cacheNamespace = 'git-raw-refs';

    const cachedResult = await renovateCache.get<RawRefs[]>(
      cacheNamespace,
      lookupName
    );
    /* istanbul ignore next line */
    if (cachedResult) {
      return cachedResult;
    }

    // fetch remote tags
    const lsRemote = await git.listRemote([
      '--tags',
      '--heads',
      '--refs',
      lookupName,
    ]);

    if (!lsRemote) {
      return null;
    }

    const refs = lsRemote
      .trim()
      .replace(/^.+?refs\//gm, '')
      .split('\n');

    const refMatch = /(?<type>\w+)\/(?<value>.*)/;
    const result = refs.map((ref) => {
      const match = refMatch.exec(ref);
      return {
        type: match.groups.type,
        value: match.groups.value,
      };
    });

    await renovateCache.set(cacheNamespace, lookupName, result, cacheMinutes);
    return result;
  } catch (err) {
    logger.error({ err }, `Git-Raw-Refs lookup error in ${lookupName}`);
  }
  return null;
}

export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  try {
    const rawRefs: RawRefs[] = await getRawRefs({ lookupName });

    const refs = rawRefs
      .filter((ref) => ref.type === 'tags' || ref.type === 'heads')
      .map((ref) => ref.value)
      .filter((ref) => semver.isVersion(ref));

    const uniqueRefs = [...new Set(refs)];

    const sourceUrl = lookupName.replace(/\.git$/, '').replace(/\/$/, '');

    const result: ReleaseResult = {
      sourceUrl,
      releases: uniqueRefs.map((ref) => ({
        version: ref,
        gitRef: ref,
      })),
    };

    return result;
  } catch (err) {
    logger.error({ err }, `Git-Refs lookup error in ${lookupName}`);
  }
  return null;
}

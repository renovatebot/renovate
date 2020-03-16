import simpleGit from 'simple-git/promise';
import { logger } from '../../logger';
import { ReleaseResult, GetReleasesConfig } from '../common';

export const id = 'git-refs';

const cacheNamespace = 'git-refs';
const cacheMinutes = 10;

// git will prompt for known hosts or passwords, unless we activate BatchMode
process.env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';

export async function getPkgReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const git = simpleGit();
  try {
    const cachedResult = await renovateCache.get<ReleaseResult>(
      cacheNamespace,
      lookupName
    );
    /* istanbul ignore next line */
    if (cachedResult) return cachedResult;

    // fetch remote tags
    const lsRemote = await git.listRemote([lookupName, '--sort=-v:refname']);

    if (!lsRemote) {
      return null;
    }

    const refs = lsRemote.replace(/^.+?refs\//gm, '').split('\n');

    const sourceUrl = lookupName.replace(/\.git$/, '').replace(/\/$/, '');

    const result: ReleaseResult = {
      sourceUrl,
      releases: refs.map(ref => ({
        version: ref,
        gitRef: ref,
      })),
    };

    await renovateCache.set(cacheNamespace, lookupName, result, cacheMinutes);
    return result;
  } catch (e) {
    logger.debug(`Error looking up refs in ${lookupName}`);
  }
  return null;
}

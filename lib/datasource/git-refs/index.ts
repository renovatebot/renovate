import simpleGit from 'simple-git/promise';
import * as semver from '../../versioning/semver';
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
    if (cachedResult) {
      return cachedResult;
    }

    // fetch remote tags
    const lsRemote = await git.listRemote([lookupName, '--sort=-v:refname']);

    if (!lsRemote) {
      return null;
    }

    const refs = lsRemote
      .replace(/^.+?refs\/tags\//gm, '')
      .replace(/^.+?refs\/heads\//gm, '')
      .split('\n')
      .filter(tag => semver.isVersion(tag));

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
  } catch (err) {
    logger.debug({ err }, `Git-Refs lookup error in ${lookupName}`);
  }
  return null;
}

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
  filterByTags,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const git = simpleGit();
  try {
    const cachedResult = await renovateCache.get<ReleaseResult>(
      cacheNamespace,
      lookupName
    );
    /* istanbul ignore next line */
    if (cachedResult && !filterByTags) {
      return cachedResult;
    }

    // fetch remote tags
    const lsRemote = await git.listRemote([
      lookupName,
      '--sort=-v:refname',
      filterByTags,
    ]);

    if (!lsRemote) {
      return null;
    }

    const refs = lsRemote
      .replace(/^.+?refs\/tags\//gm, '')
      .replace(/^.+?refs\/heads\//gm, '')
      .split('\n')
      .filter(tag => semver.isVersion(tag));

    const uniqueRefs = [...new Set(refs)];

    const sourceUrl = lookupName.replace(/\.git$/, '').replace(/\/$/, '');

    const result: ReleaseResult = {
      sourceUrl,
      releases: uniqueRefs.map(ref => ({
        version: ref,
        gitRef: ref,
      })),
    };

    if (filterByTags) {
      return result;
    }

    await renovateCache.set(cacheNamespace, lookupName, result, cacheMinutes);
    return result;
  } catch (err) {
    logger.debug({ err }, `Git-Refs lookup error in ${lookupName}`);
  }
  return null;
}

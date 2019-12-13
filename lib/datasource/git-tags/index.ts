import simpleGit from 'simple-git/promise';
import * as semver from '../../versioning/semver';
import { logger } from '../../logger';
import { ReleaseResult, PkgReleaseConfig } from '../common';

const cacheNamespace = 'git-tags';
const cacheMinutes = 10;

// git will prompt for known hosts or passwords, unless we activate BatchMode
process.env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';

export async function getPkgReleases({
  lookupName,
}: PkgReleaseConfig): Promise<ReleaseResult | null> {
  const git = simpleGit();
  try {
    const cachedResult = await renovateCache.get<ReleaseResult>(
      cacheNamespace,
      lookupName
    );
    /* istanbul ignore next line */
    if (cachedResult) return cachedResult;

    // fetch remote tags
    const lsRemote = await git.listRemote([
      '--sort=-v:refname',
      '--tags',
      lookupName,
    ]);
    // extract valid tags from git ls-remote which looks like 'commithash\trefs/tags/1.2.3
    const tags = lsRemote
      .replace(/^.+?refs\/tags\//gm, '')
      .split('\n')
      .filter(tag => semver.isVersion(tag));
    const sourceUrl = lookupName.replace(/\.git$/, '').replace(/\/$/, '');
    const result: ReleaseResult = {
      sourceUrl,
      releases: tags.map(tag => ({
        version: semver.isValid(tag),
        gitRef: tag,
      })),
    };

    await renovateCache.set(cacheNamespace, lookupName, result, cacheMinutes);
    return result;
  } catch (e) {
    logger.debug(`Error looking up tags in ${lookupName}`);
  }
  return null;
}

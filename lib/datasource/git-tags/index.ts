import * as semver from '../../versioning/semver';
import { logger } from '../../logger';
import { ReleaseResult, GetReleasesConfig } from '../common';
import * as gitRefs from '../git-refs';

export const id = 'git-tags';

const cacheNamespace = 'git-tags';
const cacheMinutes = 10;

// git will prompt for known hosts or passwords, unless we activate BatchMode
process.env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';

export async function getPkgReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
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
    const lsRemote = await gitRefs.getPkgReleases({ lookupName });

    // extract valid tags from git ls-remote which looks like 'commithash\trefs/tags/1.2.3
    const refs = lsRemote.releases.map(release => release.gitRef);

    const tags = refs
      .map(ref => ref.replace(/^tags\//gm, ''))
      .filter(tag => semver.isVersion(tag));

    const sourceUrl = lookupName.replace(/\.git$/, '').replace(/\/$/, '');
    const result: ReleaseResult = {
      sourceUrl,
      releases: tags.map(tag => ({
        version: tag,
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

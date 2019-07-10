const simpleGit = require('simple-git/promise');
const semver = require('semver');

const cacheNamespace = 'git-tags';
const cacheMinutes = 10;

// git will prompt for known hosts or passwords, unless we activate BatchMode
process.env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';

async function getPkgReleases({ lookupName }) {
  const git = simpleGit();
  try {
    const cachedResult = await renovateCache.get(cacheNamespace, lookupName);
    /* istanbul ignore next line */
    if (cachedResult) return cachedResult;

    // fetch remote tags
    const lsRemote = await git.listRemote([
      '--sort=-v:refname',
      '--tags',
      lookupName,
    ]);
    // get stable tags via regex. stable meaning only digits, dots and a leading 'v' will be allowed
    const tags = String(lsRemote).match(/(v?[\d.]+)$/gm);
    const result = {
      sourceUrl: lookupName,
      releases: tags.map(tag => ({
        version: semver.isValid(tag),
        gitref: tag,
      })),
    };

    await renovateCache.set(cacheNamespace, lookupName, result, cacheMinutes);
    return result;
  } catch (e) {
    logger.debug(`Error looking up tags in ${lookupName}`);
  }
  return null;
}

module.exports = {
  getPkgReleases,
};

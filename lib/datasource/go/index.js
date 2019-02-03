const got = require('got');
const github = require('../github');

module.exports = {
  getPkgReleases,
  getDigest,
};

async function getDatasource(name) {
  if (name.startsWith('gopkg.in/')) {
    const [pkg] = name.replace('gopkg.in/', '').split('.');
    if (pkg.includes('/')) {
      return { datasource: 'github', lookupName: pkg };
    }
    return { datasource: 'github', lookupName: `go-${pkg}/${pkg}` };
  }
  if (name.startsWith('github.com/')) {
    return {
      datasource: 'github',
      lookupName: name.replace('github.com/', ''),
    };
  }
  const pkgUrl = `https://${name}?go-get=1`;
  try {
    const res = (await got(pkgUrl, {
      retry: 5,
    })).body;
    const sourceMatch = res.match(
      new RegExp(`<meta name="go-source" content="${name}\\s+([^\\s]+)`)
    );
    if (sourceMatch) {
      const [, goSourceUrl] = sourceMatch;
      logger.debug({ depName: name, goSourceUrl }, 'Go lookup source url');
      if (goSourceUrl && goSourceUrl.startsWith('https://github.com/')) {
        return {
          datasource: 'github',
          lookupName: name.replace('https://github.com/', ''),
        };
      }
    } else {
      logger.trace({ depName: name }, 'No go-source header found');
    }
    return null;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ dependency: name }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
      });
      return null;
    }
    logger.info({ err, name }, 'go lookup failure: Unknown error');
    return null;
  }
}

/*
 * go.getPkgReleases
 *
 * This datasource resolves a go module URL into its source repository
 *  and then fetch it if it is on GitHub.
 *
 * This function will:
 *  - Determine the source URL for the module
 *  - Call the respective getPkgReleases in github to retrieve the tags
 */

async function getPkgReleases({ lookupName }) {
  logger.trace(`go.getPkgReleases(${lookupName})`);
  const source = await getDatasource(lookupName);
  if (source && source.datasource === 'github') {
    const res = await github.getPkgReleases(source);
    if (res && res.releases) {
      res.releases = res.releases.filter(
        release => release.version && release.version.startsWith('v')
      );
    }
    return res;
  }
  return null;
}

/*
 * go.getDigest
 *
 * This datasource resolves a go module URL into its source repository
 *  and then fetches the digest it if it is on GitHub.
 *
 * This function will:
 *  - Determine the source URL for the module
 *  - Call the respective getDigest in github to retrieve the commit hash
 */

async function getDigest({ lookupName }) {
  const source = await getDatasource(lookupName);
  if (source && source.datasource === 'github') {
    const digest = await github.getDigest(source);
    return digest;
  }
  return null;
}

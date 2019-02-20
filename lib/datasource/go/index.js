const got = require('got');
const github = require('../github');
const { parse } = require('../../util/purl');

module.exports = {
  getPkgReleases,
  getDigest,
};

function getGithubPurl(repo) {
  return {
    fullname: repo.replace(/\/$/, ''),
    qualifiers: {},
  };
}

async function getSourcePurl(name) {
  if (name.startsWith('gopkg.in/')) {
    const [pkg] = name.replace('gopkg.in/', '').split('.');
    if (pkg.includes('/')) {
      return getGithubPurl(pkg);
    }
    return getGithubPurl(`go-${pkg}/${pkg}`);
  }
  if (name.startsWith('github.com/')) {
    return getGithubPurl(name.replace('github.com/', ''));
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
        return getGithubPurl(goSourceUrl.replace('https://github.com/', ''));
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

async function getPkgReleases(purl) {
  const { fullname: name } = purl;
  logger.trace(`go.getPkgReleases(${name})`);
  const githubPurl = await getSourcePurl(name);
  if (githubPurl) {
    const githubTags = await github.getPkgReleases(githubPurl);
    if (githubTags && githubTags.releases) {
      githubTags.releases = githubTags.releases.filter(
        release => release.version && release.version.startsWith('v')
      );
    }
    return githubTags;
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

async function getDigest(config) {
  const purl = parse(config.purl);
  const name = purl ? purl.fullname : config.depName;
  const githubPurl = await getSourcePurl(name);
  if (githubPurl) {
    const githubRepo = githubPurl.fullname;
    const digest = await github.getDigest({ ...config, githubRepo });
    return digest;
  }
  return null;
}

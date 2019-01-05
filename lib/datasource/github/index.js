const ghGot = require('../../platform/github/gh-got-wrapper');

module.exports = {
  getPreset,
  getDigest,
  getPkgReleases,
};

const map = new Map();

async function getPreset(pkgName, presetName = 'default') {
  if (presetName !== 'default') {
    throw new Error(
      { pkgName, presetName },
      'Sub-preset names are not supported with GitHub datasource'
    );
  }
  let res;
  try {
    const url = `https://api.github.com/repos/${pkgName}/contents/renovate.json`;
    res = Buffer.from((await ghGot(url)).body.content, 'base64').toString();
  } catch (err) {
    logger.debug('Failed to retrieve renovate.json from repo');
    throw new Error('dep not found');
  }
  try {
    return JSON.parse(res);
  } catch (err) {
    logger.debug('Failed to parse renovate.json');
    throw new Error('invalid preset JSON');
  }
}

const cacheNamespace = 'datasource-github';
function getCacheKey(repo, type) {
  return `${repo}:${type}`;
}

/*
 * github.getDigest
 *
 * The `newValue` supplied here should be a valid tag for the docker image.
 *
 * This function will simply return the latest commit hash for the configured repository.
 */

async function getDigest({ lookupName: githubRepo }) {
  const cachedResult = await renovateCache.get(
    cacheNamespace,
    getCacheKey(githubRepo, 'commit')
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  let digest;
  try {
    const url = `https://api.github.com/repos/${githubRepo}/commits?per_page=1`;
    digest = (await ghGot(url)).body[0].sha;
  } catch (err) {
    logger.info(
      { githubRepo, err },
      'Error getting latest commit from GitHub repo'
    );
  }
  if (!digest) {
    return null;
  }
  const cacheMinutes = 10;
  await renovateCache.set(
    cacheNamespace,
    getCacheKey(githubRepo, 'commit'),
    digest,
    cacheMinutes
  );
  return digest;
}

/*
 * github.getPkgReleases
 *
 * This function can be used to fetch releases with a customisable version scheme (e.g. semver) and with either tags or releases.
 *
 * This function will:
 *  - Fetch all tags or releases (depending on configuration)
 *  - Sanitize the versions if desired (e.g. strip out leading 'v')
 *  - Return a dependency object containing sourceUrl string and releases array
 */

async function getPkgReleases({ datasourceType = 'tags', lookupName: repo }) {
  let versions;
  const cachedResult = await renovateCache.get(
    cacheNamespace,
    getCacheKey(repo, datasourceType)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    if (datasourceType === 'release') {
      const url = `https://api.github.com/repos/${repo}/releases?per_page=100`;
      versions = (await ghGot(url, { paginate: true })).body.map(
        o => o.tag_name
      );
    } else {
      // tag
      const url = `https://api.github.com/repos/${repo}/tags?per_page=100`;
      versions = (await ghGot(url, {
        cache: process.env.RENOVATE_SKIP_CACHE ? undefined : map,
        paginate: true,
      })).body.map(o => o.name);
    }
  } catch (err) {
    logger.info(
      { repo, err, message: err.message },
      'Error retrieving from github'
    );
  }
  if (!versions) {
    return null;
  }
  const dependency = {
    sourceUrl: 'https://github.com/' + repo,
  };
  dependency.releases = versions.map(version => ({
    version,
    gitRef: version,
  }));
  const cacheMinutes = 10;
  await renovateCache.set(
    cacheNamespace,
    getCacheKey(repo, datasourceType),
    dependency,
    cacheMinutes
  );
  return dependency;
}

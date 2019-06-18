const ghGot = require('../../platform/github/gh-got-wrapper');
const got = require('../../util/got');

module.exports = {
  getPreset,
  getDigest,
  getPkgReleases,
};

async function fetchJSONFile(repo, fileName) {
  const url = `https://api.github.com/repos/${repo}/contents/${fileName}`;
  const opts = {
    headers: {
      accept: global.appMode
        ? 'application/vnd.github.machine-man-preview+json'
        : 'application/vnd.github.v3+json',
    },
    json: true,
    hostType: 'github',
  };
  let res;
  try {
    res = await got(url, opts);
  } catch (err) {
    logger.debug({ err }, `Failed to retrieve ${fileName} from repo`);
    throw new Error('dep not found');
  }
  try {
    const content = Buffer.from(res.body.content, 'base64').toString();
    const parsed = JSON.parse(content);
    return parsed;
  } catch (err) {
    throw new Error('invalid preset JSON');
  }
}

async function getPreset(pkgName, presetName = 'default') {
  if (presetName === 'default') {
    try {
      const defaultJson = await fetchJSONFile(pkgName, 'default.json');
      return defaultJson;
    } catch (err) {
      if (err.message === 'dep not found') {
        logger.info('default.json preset not found - trying renovate.json');
        return fetchJSONFile(pkgName, 'renovate.json');
      }
      throw err;
    }
  }
  return fetchJSONFile(pkgName, `${presetName}.json`);
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

async function getTagCommit(githubRepo, tag) {
  const cachedResult = await renovateCache.get(
    cacheNamespace,
    getCacheKey(githubRepo, `tag-${tag}`)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  let digest;
  try {
    const url = `https://api.github.com/repos/${githubRepo}/git/refs/tags/${tag}`;
    const res = (await ghGot(url)).body.object;
    if (res.type === 'commit') {
      digest = res.sha;
    } else if (res.type === 'tag') {
      digest = (await ghGot(res.url)).body.object.sha;
    } else {
      logger.warn({ res }, 'Unknown git tag refs type');
    }
  } catch (err) {
    logger.info(
      { githubRepo, err },
      'Error getting tag commit from GitHub repo'
    );
  }
  if (!digest) {
    return null;
  }
  const cacheMinutes = 120;
  await renovateCache.set(
    cacheNamespace,
    getCacheKey(githubRepo, `tag-${tag}`),
    digest,
    cacheMinutes
  );
  return digest;
}

async function getDigest({ lookupName: githubRepo }, newValue) {
  if (newValue && newValue.length) {
    return getTagCommit(githubRepo, newValue);
  }
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

async function getPkgReleases({ lookupName: repo, lookupType }) {
  let versions;
  const cachedResult = await renovateCache.get(
    cacheNamespace,
    getCacheKey(repo, lookupType || 'tags')
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    if (lookupType === 'releases') {
      const url = `https://api.github.com/repos/${repo}/releases?per_page=100`;
      versions = (await ghGot(url, { paginate: true })).body.map(
        o => o.tag_name
      );
    } else {
      // tag
      const url = `https://api.github.com/repos/${repo}/tags?per_page=100`;
      versions = (await ghGot(url, {
        paginate: true,
      })).body.map(o => o.name);
    }
  } catch (err) {
    logger.info({ repo, err }, 'Error retrieving from github');
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
    getCacheKey(repo, lookupType),
    dependency,
    cacheMinutes
  );
  return dependency;
}

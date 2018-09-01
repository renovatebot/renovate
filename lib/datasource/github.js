const cacache = require('cacache/en');
const os = require('os');
const { DateTime } = require('luxon');

const ghGot = require('../platform/github/gh-got-wrapper');
const versioning = require('../versioning');

module.exports = {
  getPreset,
  getPkgReleases,
  rmAllCache,
};

const datasourceCache =
  (process.env.RENOVATE_TMPDIR || os.tmpdir()) +
  '/renovate-gh-datasource-cache-v1';

async function getCachedResult(repo, type) {
  try {
    const cacheVal = await cacache.get(datasourceCache, `${repo}-${type}`);
    const cachedResult = JSON.parse(cacheVal.data.toString());
    if (cachedResult) {
      if (DateTime.local() < DateTime.fromISO(cachedResult.expiry)) {
        logger.debug(
          { repo, type },
          'Returning cached github datasource result'
        );
        delete cachedResult.expiry;
        return cachedResult;
      }
      // istanbul ignore next
      logger.debug('Cache expiry');
    }
  } catch (err) {
    logger.debug('Cache miss');
  }
  return null;
}

async function setCachedResult(repo, type, res) {
  logger.debug({ repo, type }, 'Saving cached github datasource');
  await cacache.put(
    datasourceCache,
    `${repo}-${type}`,
    JSON.stringify({ ...res, expiry: DateTime.local().plus({ minutes: 10 }) })
  );
}

async function rmAllCache() {
  await cacache.rm.all(datasourceCache);
}

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
    const url = `repos/${pkgName}/contents/renovate.json`;
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

async function getPkgReleases(purl, config) {
  const { versionScheme } = config || {};
  const { fullname: repo, qualifiers: options } = purl;
  let versions;
  const cachedResult = await getCachedResult(repo, options.ref);
  if (cachedResult) {
    return cachedResult;
  }
  try {
    if (options.ref === 'release') {
      const url = `repos/${repo}/releases?per_page=100`;
      versions = (await ghGot(url, { paginate: true })).body.map(
        o => o.tag_name
      );
    } else {
      // tag
      const url = `repos/${repo}/tags?per_page=100`;
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
  // Filter by semver if no versionScheme provided
  const { isVersion, sortVersions } = versioning(versionScheme);
  // Return a sorted list of valid Versions
  versions = versions.filter(isVersion).sort(sortVersions);
  const dependency = {
    repositoryUrl: 'https://github.com/' + repo,
  };
  dependency.releases = versions.map(version => ({
    version: options.sanitize === 'true' ? isVersion(version) : version,
    gitRef: version,
  }));
  setCachedResult(repo, options.ref, dependency);
  return dependency;
}

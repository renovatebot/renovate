const { parse } = require('../util/purl');
const versioning = require('../versioning');

const orb = require('./orb');
const docker = require('./docker');
const github = require('./github');
const go = require('./go');
const npm = require('./npm');
const nuget = require('./nuget');
const packagist = require('./packagist');
const pypi = require('./pypi');
const terraform = require('./terraform');
const gitlab = require('./gitlab');
const cargo = require('./cargo');

const { addMetaData } = require('./metadata');

const datasources = {
  cargo,
  docker,
  github,
  gitlab,
  go,
  npm,
  nuget,
  orb,
  packagist,
  pypi,
  terraform,
};

const cacheNamespace = 'datasource-releases';

async function getPkgReleases(purlStr, config) {
  const res = await getRawReleases(purlStr, config);
  if (!res) {
    return res;
  }
  const versionScheme =
    config && config.versionScheme ? config.versionScheme : 'semver';
  // Filter by version scheme
  const { isVersion, sortVersions } = versioning.get(versionScheme);
  // Return a sorted list of valid Versions
  function sortReleases(release1, release2) {
    return sortVersions(release1.version, release2.version);
  }
  if (res.releases) {
    res.releases = res.releases
      .filter(release => isVersion(release.version))
      .sort(sortReleases);
  }
  return res;
}

function getRawReleases(purlStr, config) {
  const cacheKey = cacheNamespace + purlStr;
  // The repoCache is initialized for each repo
  // By returning a Promise and reusing it, we should only fetch each package at most once
  if (!global.repoCache[cacheKey]) {
    global.repoCache[cacheKey] = fetchReleases(purlStr, config);
  }
  return global.repoCache[cacheKey];
}

async function fetchReleases(purlStr, config) {
  const purl = parse(purlStr);
  if (!purl) {
    logger.info({ purlStr }, 'Cannot parse purl');
    return null;
  }
  if (!datasources[purl.type]) {
    logger.warn({ purlStr }, 'Unknown purl type: ' + purl.type);
    return null;
  }
  const dep = await datasources[purl.type].getPkgReleases(purl, config);
  addMetaData(purl, dep);
  return dep;
}

function supportsDigests(purlStr) {
  const purl = parse(purlStr);
  return !!datasources[purl.type].getDigest;
}

function getDigest(config, value) {
  const purl = parse(config.purl);
  return datasources[purl.type].getDigest(config, value);
}

module.exports = {
  getPkgReleases,
  supportsDigests,
  getDigest,
};

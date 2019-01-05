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

async function getPkgReleases(config) {
  const {
    datasource,
    datasourceType,
    depName,
    registryUrls,
    npmrc,
    compatibility,
  } = config;
  if (!datasource) {
    return null;
  }
  const lookupName = config.lookupName || depName;
  const res = await getRawReleases({
    datasource,
    datasourceType,
    lookupName,
    registryUrls,
    npmrc,
    compatibility,
  });
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

function getRawReleases(config) {
  const cacheKey = cacheNamespace + JSON.stringify(config);
  // The repoCache is initialized for each repo
  // By returning a Promise and reusing it, we should only fetch each package at most once
  if (!global.repoCache[cacheKey]) {
    global.repoCache[cacheKey] = fetchReleases(config);
  }
  return global.repoCache[cacheKey];
}

async function fetchReleases({
  datasource,
  datasourceType,
  lookupName,
  registryUrls,
  npmrc,
  compatibility,
}) {
  const dep = await datasources[datasource].getPkgReleases({
    datasourceType,
    lookupName,
    registryUrls,
    npmrc,
    compatibility,
  });
  addMetaData(datasource, lookupName, dep);
  return dep;
}

function supportsDigests(datasource) {
  return !!datasources[datasource].getDigest;
}

function getDigest(config, value) {
  const lookupName = config.lookupName || config.depName;
  return datasources[config.datasource].getDigest({ lookupName, value });
}

module.exports = {
  getPkgReleases,
  supportsDigests,
  getDigest,
};

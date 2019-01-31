const deepcopy = require('deepcopy');
const { addMetaData } = require('./metadata');
const { parse } = require('../util/purl');
const versioning = require('../versioning');

const cargo = require('./cargo');
const docker = require('./docker');
const github = require('./github');
const gitlab = require('./gitlab');
const go = require('./go');
const gradleVersion = require('./gradle-version');
const maven = require('./maven');
const npm = require('./npm');
const nuget = require('./nuget');
const orb = require('./orb');
const packagist = require('./packagist');
const pypi = require('./pypi');
const rubygems = require('./rubygems');
const rubyVersion = require('./ruby-version');
const terraform = require('./terraform');

const datasources = {
  cargo,
  docker,
  github,
  gitlab,
  go,
  gradleVersion,
  maven,
  npm,
  nuget,
  orb,
  packagist,
  pypi,
  rubygems,
  rubyVersion,
  terraform,
};

const cacheNamespace = 'datasource-releases';

async function getPkgReleases(config) {
  const res = await getRawReleases(config);
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
  const cacheKey = cacheNamespace + config.purl;
  // The repoCache is initialized for each repo
  // By returning a Promise and reusing it, we should only fetch each package at most once
  if (!global.repoCache[cacheKey]) {
    global.repoCache[cacheKey] = fetchReleases(config);
  }
  return global.repoCache[cacheKey];
}

async function fetchReleases(input) {
  const config = deepcopy(input);
  if (config.purl) {
    Object.assign(config, parse(config.purl));
  }
  if (!config.datasource) {
    logger.warn('No datasource found');
  }
  if (!datasources[config.datasource]) {
    logger.warn('Unknown datasource: ' + config.datasource);
    return null;
  }
  config.lookupName = config.lookupName || config.depName;
  const dep = await datasources[config.datasource].getPkgReleases(config);
  addMetaData(config, dep);
  return dep;
}

function supportsDigests(purlStr) {
  const purl = parse(purlStr);
  return !!datasources[purl.datasource].getDigest;
}

function getDigest(config, value) {
  const purl = parse(config.purl);
  return datasources[purl.datasource].getDigest(config, value);
}

module.exports = {
  getPkgReleases,
  supportsDigests,
  getDigest,
};

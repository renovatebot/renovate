const { parse } = require('../util/purl');

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

const { addMetaData } = require('./metadata');

const datasources = {
  orb,
  docker,
  github,
  go,
  npm,
  nuget,
  packagist,
  pypi,
  terraform,
  gitlab,
};

async function getPkgReleases(purlStr, config) {
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

const { parse } = require('../util/purl');

const docker = require('./docker');
const github = require('./github');
const npm = require('./npm');
const nuget = require('./nuget');
const packagist = require('./packagist');
const pypi = require('./pypi');

const datasources = {
  docker,
  github,
  npm,
  nuget,
  packagist,
  pypi,
};

function getDependency(purlStr, config) {
  const purl = parse(purlStr);
  if (!purl) {
    return null;
  }
  if (!datasources[purl.type]) {
    logger.warn('Unknown purl type: ' + purl.type);
    return null;
  }
  return datasources[purl.type].getDependency(purl, config);
}

function supportsDigests(purlStr) {
  const purl = parse(purlStr);
  return !!datasources[purl.type].getDependency;
}

function getDigest(purlStr, value) {
  const purl = parse(purlStr);
  return datasources[purl.type].getDigest(
    purl.qualifiers.registry,
    purl.fullname,
    value
  );
}

module.exports = {
  getDependency,
  supportsDigests,
  getDigest,
};

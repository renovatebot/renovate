const { parse } = require('../util/purl');

const github = require('./github');
const npm = require('./npm');
const nuget = require('./nuget');
const packagist = require('./packagist');
const pypi = require('./pypi');

const datasources = {
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

module.exports = {
  getDependency,
};

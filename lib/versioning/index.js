const semver = require('./semver');
const semverComposer = require('./semver-composer');
const pep440 = require('./pep440');
const node = require('./node');

const schemes = {
  semver,
  semverComposer,
  pep440,
  node,
};

module.exports = function getVersionScheme(versionScheme) {
  if (!versionScheme) {
    logger.debug('Missing versionScheme');
    return semver;
  }
  const scheme = schemes[versionScheme];
  if (!scheme) {
    logger.warn({ versionScheme }, 'Unknown version scheme');
    return semver;
  }
  return scheme;
};

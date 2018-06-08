const semver = require('./semver');
const semverComposer = require('./semver-composer');
const pep440 = require('./pep440');
const nodever = require('./nodever');

const schemes = {
  semver,
  semverComposer,
  pep440,
  nodever,
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

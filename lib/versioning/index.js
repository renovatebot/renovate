const semver = require('./semver');
const pep440 = require('./pep440');

const schemes = {
  semver,
  pep440,
};

module.exports = function getVersionScheme(versionScheme) {
  const scheme = schemes[versionScheme];
  if (!scheme) {
    logger.warn({ versionScheme }, 'Unknown verion scheme');
    return semver;
  }
  return scheme;
};

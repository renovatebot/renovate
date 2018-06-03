const semver = require('./semver');

const schemes = {
  semver,
};

module.exports = function getVersionScheme(versionScheme) {
  const scheme = schemes[versionScheme];
  if (!scheme) {
    logger.warn({ versionScheme }, 'Unknown verion scheme');
    return semver;
  }
  return scheme;
};

const supportedSchemes = require('../config/definitions')
  .getOptions()
  .find(option => option.name === 'versionScheme').allowedValues;

const schemes = {};

for (const scheme of supportedSchemes) {
  schemes[scheme] = require('./' + scheme); // eslint-disable-line
}

module.exports = {
  get,
};

function get(versionScheme) {
  if (!versionScheme) {
    logger.debug('Missing versionScheme');
    return schemes.semver;
  }
  const scheme = schemes[versionScheme];
  if (!scheme) {
    logger.warn({ versionScheme }, 'Unknown version scheme');
    return schemes.semver;
  }
  return scheme;
}

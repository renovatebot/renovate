const supportedSchemes = [
  'docker',
  'loose',
  'pep440',
  'semver',
  'semver-composer',
  'semver-hashicorp',
];

const schemes = {};

for (const scheme of supportedSchemes) {
  schemes[scheme] = require('./' + scheme); // eslint-disable-line
}

module.exports = {
  get,
  supportedSchemes,
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

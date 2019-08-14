import { logger } from '../logger';
import { getOptions } from '../config/definitions';
import { VersioningApi } from './common';

export * from './common';

const supportedSchemes = getOptions().find(
  option => option.name === 'versionScheme'
).allowedValues;

const schemes: Record<string, VersioningApi> = {};

for (const scheme of supportedSchemes) {
  schemes[scheme] = require('./' + scheme).api; // eslint-disable-line
}

export { get };

function get(versionScheme: string) {
  if (!versionScheme) {
    logger.debug('Missing versionScheme');
    return schemes.semver;
  }
  let schemeName: string;
  let schemeConfig: string;
  if (versionScheme.includes(':')) {
    const versionSplit = versionScheme.split(':');
    schemeName = versionSplit.shift();
    schemeConfig = versionSplit.join(':');
  } else {
    schemeName = versionScheme;
  }
  const scheme = schemes[schemeName];
  if (!scheme) {
    logger.warn({ versionScheme }, 'Unknown version scheme');
    return schemes.semver;
  }
  if (schemeConfig) {
    if (!scheme.configure) {
      logger.warn(
        { versionScheme },
        'Version config specified for unsupported scheme'
      );
      return scheme;
    }
    scheme.configure(schemeConfig);
  }
  return scheme;
}

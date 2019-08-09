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

function get(versionScheme: string, versionConfig?: string) {
  if (!versionScheme) {
    logger.debug('Missing versionScheme');
    return schemes.semver;
  }
  const scheme = schemes[versionScheme];
  if (!scheme) {
    logger.warn({ versionScheme }, 'Unknown version scheme');
    return schemes.semver;
  }
  if (versionConfig) {
    if (!scheme.configure) {
      logger.warn(
        { versionScheme },
        'Version config specified for unsupported scheme'
      );
      return scheme;
    }
    scheme.configure(versionConfig);
  }
  return scheme;
}

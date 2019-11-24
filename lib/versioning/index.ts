import { logger } from '../logger';
import { getOptions } from '../config/definitions';
import {
  VersioningApi,
  VersioningApiConstructor,
  isVersioningApiConstructor,
} from './common';

export * from './common';

const supportedSchemes = getOptions().find(
  option => option.name === 'versionScheme'
).allowedValues;

const schemes: Record<string, VersioningApi | VersioningApiConstructor> = {};

for (const scheme of supportedSchemes) {
  schemes[scheme] = require('./' + scheme).api; // eslint-disable-line
}

export function get(versionScheme: string): VersioningApi {
  if (!versionScheme) {
    logger.debug('Missing versionScheme');
    return schemes.semver as VersioningApi;
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
    return schemes.semver as VersioningApi;
  }
  // istanbul ignore if: needs an implementation
  if (isVersioningApiConstructor(scheme)) {
    // eslint-disable-next-line new-cap
    return new scheme(schemeConfig);
  }
  return scheme;
}

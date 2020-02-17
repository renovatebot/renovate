import fs from 'fs';
import { logger } from '../logger';
import {
  VersioningApi,
  VersioningApiConstructor,
  isVersioningApiConstructor,
} from './common';

export * from './common';

const schemes: Record<string, VersioningApi | VersioningApiConstructor> = {};

const versionSchemeList: string[] = [];

export const getVersionSchemeList = (): string[] => versionSchemeList;

const versionSchemes = fs
  .readdirSync(__dirname, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name)
  .sort();

for (const scheme of versionSchemes) {
  try {
    schemes[scheme] = require('./' + scheme).api; // eslint-disable-line
    versionSchemeList.push(scheme);
  } catch (err) /* istanbul ignore next */ {
    logger.fatal({ err }, `Can not load version scheme "${scheme}".`);
    process.exit(1);
  }
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

import fs from 'fs';
import { logger } from '../logger';
import {
  VersioningApi,
  VersioningApiConstructor,
  isVersioningApiConstructor,
} from './common';

export * from './common';

const schemes: Record<string, VersioningApi | VersioningApiConstructor> = {};

const versioningList: string[] = [];

export const getVersioningList = (): string[] => versioningList;

const versionings = fs
  .readdirSync(__dirname, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name)
  .sort();

for (const scheme of versionings) {
  try {
    schemes[scheme] = require('./' + scheme).api; // eslint-disable-line
    versioningList.push(scheme);
  } catch (err) /* istanbul ignore next */ {
    logger.fatal({ err }, `Can not load versioning "${scheme}".`);
    process.exit(1);
  }
}

export function get(versioning: string): VersioningApi {
  if (!versioning) {
    logger.debug('Missing versioning');
    return schemes.semver as VersioningApi;
  }
  let schemeName: string;
  let schemeConfig: string;
  if (versioning.includes(':')) {
    const versionSplit = versioning.split(':');
    schemeName = versionSplit.shift();
    schemeConfig = versionSplit.join(':');
  } else {
    schemeName = versioning;
  }
  const scheme = schemes[schemeName];
  if (!scheme) {
    logger.warn({ versioning }, 'Unknown versioning');
    return schemes.semver as VersioningApi;
  }
  // istanbul ignore if: needs an implementation
  if (isVersioningApiConstructor(scheme)) {
    // eslint-disable-next-line new-cap
    return new scheme(schemeConfig);
  }
  return scheme;
}

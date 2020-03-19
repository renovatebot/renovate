import fs from 'fs';
import { logger } from '../logger';
import {
  VersioningApi,
  VersioningApiConstructor,
  isVersioningApiConstructor,
} from './common';

export * from './common';

const allVersioning: Record<
  string,
  VersioningApi | VersioningApiConstructor
> = {};

const versioningList: string[] = [];

export const getVersioningList = (): string[] => versioningList;

const versionings = fs
  .readdirSync(__dirname, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('_'))
  .map(dirent => dirent.name)
  .sort();

for (const versioning of versionings) {
  try {
    allVersioning[versioning] = require('./' + versioning).api; // eslint-disable-line
    versioningList.push(versioning);
  } catch (err) /* istanbul ignore next */ {
    logger.fatal({ err }, `Can not load versioning "${versioning}".`);
    process.exit(1);
  }
}

export function get(versioning: string): VersioningApi {
  if (!versioning) {
    logger.debug('Missing versioning');
    return allVersioning.semver as VersioningApi;
  }
  let versioningName: string;
  let versioningConfig: string;

  if (versioning.includes(':')) {
    const versionSplit = versioning.split(':');
    versioningName = versionSplit.shift();
    versioningConfig = versionSplit.join(':');
  } else {
    versioningName = versioning;
  }
  const theVersioning = allVersioning[versioningName];
  if (!theVersioning) {
    logger.warn({ versioning }, 'Unknown versioning');
    return allVersioning.semver as VersioningApi;
  }
  // istanbul ignore if: needs an implementation
  if (isVersioningApiConstructor(theVersioning)) {
    // eslint-disable-next-line new-cap
    return new theVersioning(versioningConfig);
  }
  return theVersioning;
}

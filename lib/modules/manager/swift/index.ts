import { GitTagsDatasource } from '../../datasource/git-tags';
import * as swiftVersioning from '../../versioning/swift';
export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const displayName = 'Swift Package Manager';
export const url = 'https://www.swift.org/package-manager/';

export const supportsLockFileMaintenance = true;
export const supportedDatasources = [GitTagsDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)Package\\.swift'],
  versioning: swiftVersioning.id,
  rangeStrategy: 'bump',
  pinDigests: false,
};

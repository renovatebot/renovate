import { GitTagsDatasource } from '../../datasource/git-tags';
import * as swiftVersioning from '../../versioning/swift';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';

export { extractPackageFile, updateArtifacts };

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

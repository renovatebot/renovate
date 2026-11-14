import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import * as nimbleVersioning from '../../versioning/nimble/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { knownDepTypes } from './dep-types.ts';
export { extractPackageFile } from './extract.ts';
export { updateDependency } from './update.ts';

export const displayName = 'nimble';
export const url = 'https://github.com/nim-lang/nimble';
export const categories: Category[] = ['nim'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)[^/]+\\.nimble$/'],
  versioning: nimbleVersioning.id,
};

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['nimble.lock', 'atlas.lock'];
export const lockFileMaintenanceIsDelegatedToPackageManager = true;

export const supportedDatasources = [GitTagsDatasource.id];

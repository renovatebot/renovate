export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

import type { Category } from '../../../constants/index.ts';

export { getRangeStrategy } from './range.ts';

import { ConanDatasource } from '../../datasource/conan/index.ts';
import * as conan from '../../versioning/conan/index.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['conan.lock'];
export const url = 'https://docs.conan.io';
export const categories: Category[] = ['c'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)conanfile\\.(txt|py)$/'],
  datasource: ConanDatasource.id,
  versioning: conan.id,
};

export const supportedDatasources = [ConanDatasource.id];

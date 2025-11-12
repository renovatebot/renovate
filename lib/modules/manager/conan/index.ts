export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
import type { Category } from '../../../constants';
export { getRangeStrategy } from './range';
import { ConanDatasource } from '../../datasource/conan';
import * as conan from '../../versioning/conan';

export const supportsLockFileMaintenance = true;
export const url = 'https://docs.conan.io';
export const categories: Category[] = ['c'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)conanfile\\.(txt|py)$/'],
  datasource: ConanDatasource.id,
  versioning: conan.id,
};

export const supportedDatasources = [ConanDatasource.id];

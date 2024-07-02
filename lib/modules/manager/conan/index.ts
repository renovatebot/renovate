export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
import type { Category } from '../../../constants';
export { getRangeStrategy } from './range';
import { ConanDatasource } from '../../datasource/conan';
import * as conan from '../../versioning/conan';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)conanfile\\.(txt|py)$'],
  datasource: ConanDatasource.id,
  versioning: conan.id,
  enabled: false, // See https://github.com/renovatebot/renovate/issues/14170
};

export const categories: Category[] = ['c'];

export const supportedDatasources = [ConanDatasource.id];

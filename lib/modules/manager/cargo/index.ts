import type { Category } from '../../../constants';
import { CrateDatasource } from '../../datasource/crate';
import * as cargoVersioning from '../../versioning/cargo';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';
export { getRangeStrategy } from './range';
export { updateLockedDependency } from './update-locked';

export const supportsLockFileMaintenance = true;

export { extractPackageFile, updateArtifacts };

export const url = 'https://doc.rust-lang.org/cargo';
export const categories: Category[] = ['rust'];

export const defaultConfig = {
  commitMessageTopic: 'Rust crate {{depName}}',
  managerFilePatterns: ['/(^|/)Cargo\\.toml$/'],
  versioning: cargoVersioning.id,
};

export const supportedDatasources = [CrateDatasource.id];

import type { Category } from '../../../constants';
import { CratesIoDatasource } from '../../datasource/crates-io';
import * as cargoVersioning from '../../versioning/cargo';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
export { getRangeStrategy } from './range';

export const supportsLockFileMaintenance = true;

export { extractPackageFile, updateArtifacts };

export const defaultConfig = {
  commitMessageTopic: 'Rust crate {{depName}}',
  fileMatch: ['(^|/)Cargo\\.toml$'],
  versioning: cargoVersioning.id,
};

export const categories: Category[] = ['rust'];

export const supportedDatasources = [CratesIoDatasource.id];

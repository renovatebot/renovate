import type { ProgrammingLanguage } from '../../../constants';
import { CrateDatasource } from '../../datasource/crate';
import * as cargoVersioning from '../../versioning/cargo';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
export { getRangeStrategy } from './range';

export const language: ProgrammingLanguage = 'rust';
export const supportsLockFileMaintenance = true;

export { extractPackageFile, updateArtifacts };

export const defaultConfig = {
  commitMessageTopic: 'Rust crate {{depName}}',
  fileMatch: ['(^|/)Cargo\\.toml$'],
  versioning: cargoVersioning.id,
};

export const supportedDatasources = [CrateDatasource.id];

import { ProgrammingLanguage } from '../../constants';
import { CrateDatasource } from '../../datasource/crate';
import * as cargoVersioning from '../../modules/versioning/cargo';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';

const language = ProgrammingLanguage.Rust;
export const supportsLockFileMaintenance = true;

export { extractPackageFile, updateArtifacts, language };

export const defaultConfig = {
  commitMessageTopic: 'Rust crate {{depName}}',
  fileMatch: ['(^|/)Cargo.toml$'],
  versioning: cargoVersioning.id,
  rangeStrategy: 'bump',
};

export const supportedDatasources = [CrateDatasource.id];

import { extractPackageFile } from './extract';
import { updateDependency } from './update';
import { updateArtifacts } from './artifacts';
import { LANGUAGE_RUST } from '../../constants/languages';
import * as cargoVersioning from '../../versioning/cargo';

const language = LANGUAGE_RUST;
// TODO: Support this
export const supportsLockFileMaintenance = false;

export { extractPackageFile, updateArtifacts, language, updateDependency };

export const defaultConfig = {
  commitMessageTopic: 'Rust crate {{depName}}',
  managerBranchPrefix: 'rust-',
  fileMatch: ['(^|/)Cargo.toml$'],
  versioning: cargoVersioning.id,
  rangeStrategy: 'bump',
};

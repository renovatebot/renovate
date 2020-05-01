import { LANGUAGE_RUST } from '../../constants/languages';
import * as cargoVersioning from '../../versioning/cargo';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';

const language = LANGUAGE_RUST;
// TODO: Support this
export const supportsLockFileMaintenance = false;

export { extractPackageFile, updateArtifacts, language };

export const defaultConfig = {
  commitMessageTopic: 'Rust crate {{depName}}',
  managerBranchPrefix: 'rust-',
  fileMatch: ['(^|/)Cargo.toml$'],
  versioning: cargoVersioning.id,
  rangeStrategy: 'bump',
};

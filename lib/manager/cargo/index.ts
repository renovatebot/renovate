import { extractPackageFile } from './extract';
import { updateDependency } from './update';
import { updateArtifacts } from './artifacts';
import { LANGUAGE_RUST } from '../../constants/languages';
import { VERSION_SCHEME_CARGO } from '../../constants/version-schemes';

const language = LANGUAGE_RUST;
// TODO: Support this
export const supportsLockFileMaintenance = false;

export { extractPackageFile, updateArtifacts, language, updateDependency };

export const defaultConfig = {
  commitMessageTopic: 'Rust crate {{depName}}',
  managerBranchPrefix: 'rust-',
  fileMatch: ['(^|/)Cargo.toml$'],
  versioning: VERSION_SCHEME_CARGO,
  rangeStrategy: 'bump',
};

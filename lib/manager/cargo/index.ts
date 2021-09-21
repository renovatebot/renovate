import { LANGUAGE_RUST } from '../../constants/languages';
import * as cargoVersioning from '../../versioning/cargo';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';

const language = LANGUAGE_RUST;
export const supportsLockFileMaintenance = true;

export { extractPackageFile, updateArtifacts, language };

export const defaultConfig = {
  commitMessageTopic: 'Rust crate {{depName}}',
  fileMatch: ['(^|/)Cargo.toml$'],
  versioning: cargoVersioning.id,
  rangeStrategy: 'bump',
};

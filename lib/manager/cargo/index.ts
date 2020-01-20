import { extractPackageFile } from './extract';
import { updateDependency } from './update';
import { updateArtifacts } from './artifacts';
import { LANGUAGE_RUST } from '../../constants/languages';

const language = LANGUAGE_RUST;
// TODO: Support this
export const supportsLockFileMaintenance = false;

export { extractPackageFile, updateArtifacts, language, updateDependency };

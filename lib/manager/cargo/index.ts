import { extractPackageFile } from './extract';
import { updateDependency } from './update';
import { updateArtifacts } from './artifacts';

const language = 'rust';
// TODO: Support this
export const supportsLockFileMaintenance = false;

export { extractPackageFile, updateArtifacts, language, updateDependency };

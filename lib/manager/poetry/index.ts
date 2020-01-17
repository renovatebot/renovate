import { LANGUAGE_PYTHON } from '../../constants/languages';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';
export { updateArtifacts } from './artifacts';

export const language = LANGUAGE_PYTHON;
export const supportsLockFileMaintenance = false;

import { LANGUAGE_PYTHON } from '../../constants/languages';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const language = LANGUAGE_PYTHON;
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)Pipfile$'],
};

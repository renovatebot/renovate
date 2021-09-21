import { LANGUAGE_PYTHON } from '../../constants/languages';

export { extractPackageFile } from '../pip_requirements/extract';
export { updateArtifacts } from './artifacts';

export const language = LANGUAGE_PYTHON;
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: [],
  lockFileMaintenance: {
    enabled: true,
    branchTopic: 'pip-compile-refresh',
    commitMessageAction: 'Refresh pip-compile outputs',
  },
};

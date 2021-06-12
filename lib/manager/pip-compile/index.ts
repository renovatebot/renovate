import { LANGUAGE_PYTHON } from '../../constants/languages';
import { extract } from '../pip_requirements/extract';

export { updateArtifacts } from './artifacts';

export const extractPackageFile = extract;

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

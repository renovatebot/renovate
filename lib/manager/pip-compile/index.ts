import { ProgrammingLanguage } from '../../constants';

export { extractPackageFile } from '../pip_requirements/extract';
export { updateArtifacts } from './artifacts';

export const language = ProgrammingLanguage.Python;
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: [],
  lockFileMaintenance: {
    enabled: true,
    branchTopic: 'pip-compile-refresh',
    commitMessageAction: 'Refresh pip-compile outputs',
  },
};

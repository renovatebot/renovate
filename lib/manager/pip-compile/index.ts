import { ProgrammingLanguage } from '../../constants';
import { PypiDatasource } from '../../datasource/pypi';

export { extractPackageFile } from '../pip_requirements/extract';
export { updateArtifacts } from './artifacts';

export const language = ProgrammingLanguage.Python;
export const supportsLockFileMaintenance = true;

export const supportedDatasources = [PypiDatasource.id];

export const defaultConfig = {
  fileMatch: [],
  lockFileMaintenance: {
    enabled: true,
    branchTopic: 'pip-compile-refresh',
    commitMessageAction: 'Refresh pip-compile outputs',
  },
};

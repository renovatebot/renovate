import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PypiDatasource } from '../../datasource/pypi';

// TODO(not7cd): unsure if both extract* exports can exist in a single manager
// export { extractPackageFile } from '../pip_requirements/extract';
export { extractAllPackageFiles } from './extract';
export { updateArtifacts } from './artifacts';
export { updateLockedDependency } from './update-locked';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: [],
  lockFileMaintenance: {
    enabled: true,
    branchTopic: 'pip-compile-refresh',
    commitMessageAction: 'Refresh pip-compile outputs',
  },
};

export const categories: Category[] = ['python'];

export const supportedDatasources = [PypiDatasource.id, GitTagsDatasource.id];

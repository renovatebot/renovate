import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PypiDatasource } from '../../datasource/pypi';

export { extractAllPackageFiles, extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const displayName = 'pip-compile';
export const url = 'https://pip-tools.readthedocs.io/en/latest/cli/pip-compile';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: [],
  lockFileMaintenance: {
    enabled: true,
    branchTopic: 'pip-compile-refresh',
    commitMessageAction: 'Refresh pip-compile outputs',
  },
};

export const supportedDatasources = [PypiDatasource.id, GitTagsDatasource.id];

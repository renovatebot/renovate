import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { PythonVersionDatasource } from '../../datasource/python-version/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractAllPackageFiles, extractPackageFile } from './extract.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['requirements.txt'];
export const lockFileMaintenanceIsDelegatedToPackageManager = true;

export const displayName = 'pip-compile';
export const url =
  'https://pip-tools.readthedocs.io/en/latest/reference/pip-compile/';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: [],
  lockFileMaintenance: {
    enabled: true,
    branchTopic: 'pip-compile-refresh',
    commitMessageAction: 'Refresh pip-compile outputs',
  },
};

export const supportedDatasources: DatasourceName[] = [
  GitTagsDatasource.id,
  PypiDatasource.id,
  PythonVersionDatasource.id,
];

export { knownDepTypes } from './dep-types.ts';

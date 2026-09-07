import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['Pipfile.lock'];
export const lockFileMaintenanceIsDelegatedToPackageManager = true;

export const url = 'https://pipenv.pypa.io/en/latest';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)Pipfile$/'],
};

export const supportedDatasources: DatasourceName[] = [PypiDatasource.id];

export { knownDepTypes, supportsDynamicDepTypesNote } from './dep-types.ts';

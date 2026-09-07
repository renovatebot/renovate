import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { GoDatasource } from '../../datasource/go/index.ts';
import { GolangVersionDatasource } from '../../datasource/golang-version/index.ts';
import { updateArtifacts } from './artifacts.ts';
import { extractPackageFile } from './extract.ts';
import { updateDependency } from './update.ts';

export { knownDepTypes } from './dep-types.ts';

export { extractPackageFile, updateArtifacts, updateDependency };

export const displayName = 'Go Modules';
export const url = 'https://go.dev/ref/mod';
export const categories: Category[] = ['golang'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)go\\.mod$/'],
  pinDigests: false,
};

export const supportedDatasources: DatasourceName[] = [
  GoDatasource.id,
  GolangVersionDatasource.id,
];

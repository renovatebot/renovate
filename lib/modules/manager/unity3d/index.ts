import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { Unity3dDatasource } from '../../datasource/unity3d/index.ts';

export const categories: Category[] = ['dotnet'];

export { extractPackageFile } from './extract.ts';

export const defaultConfig = {
  managerFilePatterns: ['**/ProjectSettings/ProjectVersion.txt'],
};

export const supportedDatasources: DatasourceName[] = [Unity3dDatasource.id];

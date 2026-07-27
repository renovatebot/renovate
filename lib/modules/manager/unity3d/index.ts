import type { Category } from '../../../constants/index.ts';
import { Unity3dDatasource } from '../../datasource/unity3d/index.ts';

export const categories: Category[] = ['dotnet'];

export { extractPackageFile } from './extract.ts';

export const defaultConfig = {
  managerFilePatterns: ['**/ProjectSettings/ProjectVersion.txt'],
};

export const supportedDatasources = [Unity3dDatasource.id];

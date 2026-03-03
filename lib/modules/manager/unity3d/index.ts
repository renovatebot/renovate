import { Unity3dDatasource } from '../../datasource/unity3d/index.ts';

export { extractPackageFile } from './extract.ts';

export const defaultConfig = {
  managerFilePatterns: ['**/ProjectSettings/ProjectVersion.txt'],
};

export const supportedDatasources = [Unity3dDatasource.id];

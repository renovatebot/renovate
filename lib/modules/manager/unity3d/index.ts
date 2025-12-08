import { Unity3dDatasource } from '../../datasource/unity3d';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  managerFilePatterns: ['**/ProjectSettings/ProjectVersion.txt'],
};

export const supportedDatasources = [Unity3dDatasource.id];

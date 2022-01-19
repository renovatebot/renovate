import { HelmDatasource } from '../../datasource/helm';
export { extractAllPackageFiles, extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [],
};

export const supportedDatasources = [HelmDatasource.id];

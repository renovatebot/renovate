import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [],
};

export const supportedDatasources = [HelmDatasource.id];

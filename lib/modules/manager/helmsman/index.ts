import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [],
  filePatterns: [],
};

export const supportedDatasources = [HelmDatasource.id];

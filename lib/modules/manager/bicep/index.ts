import { AzureBicepResourceDatasource } from '../../datasource/azure-bicep-resource';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['\\.bicep$'],
};

export const supportedDatasources = [AzureBicepResourceDatasource.id];

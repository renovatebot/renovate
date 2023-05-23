import { AzureBicepResourceDatasource } from '../../datasource/azure-bicep-resource';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['\\.bicep$'],
  filePatterns: ['**/*.bicep'], // not used yet
};

export const supportedDatasources = [AzureBicepResourceDatasource.id];

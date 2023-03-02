import { AzureBicepTypesDatasource } from '../../datasource/azure-bicep-types';

export const defaultConfig = {
  fileMatch: ['\\.bicep$'],
};

export { extractPackageFile } from './extract';

export const supportedDatasources = [AzureBicepTypesDatasource.id];

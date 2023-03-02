import { AzureBicepTypesDatasource } from '../../datasource/azure-bicep-types';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['\\.bicep$'],
};

export const supportedDatasources = [AzureBicepTypesDatasource.id];

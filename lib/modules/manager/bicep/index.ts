import type { Category } from '../../../constants';
import { AzureBicepResourceDatasource } from '../../datasource/azure-bicep-resource';

export { extractPackageFile } from './extract';

export const url =
  'https://docs.microsoft.com/azure/azure-resource-manager/bicep/overview';
export const categories: Category[] = ['iac'];

export const defaultConfig = {
  fileMatch: ['\\.bicep$'],
};

export const supportedDatasources = [AzureBicepResourceDatasource.id];

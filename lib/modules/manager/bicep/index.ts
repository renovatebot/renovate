import type { Category } from '../../../constants/index.ts';
import { AzureBicepResourceDatasource } from '../../datasource/azure-bicep-resource/index.ts';

export { extractPackageFile } from './extract.ts';

export const url =
  'https://docs.microsoft.com/azure/azure-resource-manager/bicep/overview';
export const categories: Category[] = ['iac'];

export const defaultConfig = {
  managerFilePatterns: ['/\\.bicep$/'],
};

export const supportedDatasources = [AzureBicepResourceDatasource.id];

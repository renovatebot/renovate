import type { Category } from '../../../constants';
import { AzureBicepResourceDatasource } from '../../datasource/azure-bicep-resource';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['\\.bicep$'],
};

export const categories: Category[] = ['iac'];

export const supportedDatasources = [AzureBicepResourceDatasource.id];

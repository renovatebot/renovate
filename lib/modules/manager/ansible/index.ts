import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const categories: Category[] = ['ansible', 'iac'];

export const defaultConfig = {
  fileMatch: ['(^|/)tasks/[^/]+\\.ya?ml$'],
};

export const supportedDatasources = [DockerDatasource.id];

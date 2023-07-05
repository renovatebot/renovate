import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)(?:docker-)?compose[^/]*\\.ya?ml$'],
};

export const categories: Category[] = ['docker'];

export const supportedDatasources = [DockerDatasource.id];

import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.vela\\.ya?ml$'],
};

export const supportedDatasources = [DockerDatasource.id];

export const categories: Category[] = ['ci'];

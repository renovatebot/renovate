import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import * as dockerVersioning from '../../versioning/docker';

export { extractPackageFile } from './extract';

export const supportedDatasources = [DockerDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)\\.python-version$'],
  versioning: dockerVersioning.id,
};

export const categories: Category[] = ['python'];

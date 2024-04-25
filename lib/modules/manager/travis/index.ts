import type { Category } from '../../../constants';
import { NodeVersionDatasource } from '../../datasource/node-version';
import * as nodeVersioning from '../../versioning/node';

export { extractPackageFile } from './extract';

export const supportedDatasources = [NodeVersionDatasource.id];

export const defaultConfig = {
  fileMatch: ['^\\.travis\\.ya?ml$'],
  major: {
    enabled: false,
  },
  versioning: nodeVersioning.id,
};

export const categories: Category[] = ['ci'];

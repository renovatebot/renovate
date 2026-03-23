import type { Category } from '../../../constants/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import * as nodeVersioning from '../../versioning/node/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'Travis CI';
export const url = 'https://docs.travis-ci.com';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/^\\.travis\\.ya?ml$/'],
  major: {
    enabled: false,
  },
  versioning: nodeVersioning.id,
};

export const supportedDatasources = [NodeVersionDatasource.id];

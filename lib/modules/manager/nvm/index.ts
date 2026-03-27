import type { Category } from '../../../constants/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import * as nodeVersioning from '../../versioning/node/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'nvm';
export const url = 'https://github.com/nvm-sh/nvm#readme';
export const categories: Category[] = ['js', 'node'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.nvmrc$/'],
  versioning: nodeVersioning.id,
  pinDigests: false,
};

export const supportedDatasources = [NodeVersionDatasource.id];

import type { Category } from '../../../constants/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import * as nodeVersioning from '../../versioning/node/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'nodenv';
export const url = 'https://github.com/nodenv/nodenv#readme';
export const categories: Category[] = ['js', 'node'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.node-version$/'],
  versioning: nodeVersioning.id,
};

export const supportedDatasources = [NodeVersionDatasource.id];

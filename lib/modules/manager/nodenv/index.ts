import type { Category } from '../../../constants';
import { NodeVersionDatasource } from '../../datasource/node-version';
import * as nodeVersioning from '../../versioning/node';

export { extractPackageFile } from './extract';

export const displayName = 'nodenv';
export const url = 'https://github.com/nodenv/nodenv#readme';
export const categories: Category[] = ['js', 'node'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.node-version$/'],
  versioning: nodeVersioning.id,
};

export const supportedDatasources = [NodeVersionDatasource.id];

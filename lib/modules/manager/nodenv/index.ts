import type { Category } from '../../../constants';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as nodeVersioning from '../../versioning/node';

export { extractPackageFile } from './extract';

export const displayName = 'nodenv';
export const url = 'https://github.com/nodenv/nodenv';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.node-version$'],
  versioning: nodeVersioning.id,
};

export const categories: Category[] = ['js', 'node'];

export const supportedDatasources = [GithubTagsDatasource.id];

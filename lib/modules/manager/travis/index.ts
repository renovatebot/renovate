import type { Category } from '../../../constants';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as nodeVersioning from '../../versioning/node';

export { extractPackageFile } from './extract';

export const supportedDatasources = [GithubTagsDatasource.id];

export const defaultConfig = {
  fileMatch: ['^\\.travis\\.ya?ml$'],
  major: {
    enabled: false,
  },
  versioning: nodeVersioning.id,
};

export const categories: Category[] = ['ci'];

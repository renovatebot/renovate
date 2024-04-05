import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [],
};

export const categories: Category[] = ['ci', 'cd'];

export const supportedDatasources = [DockerDatasource.id, GitTagsDatasource.id];

export { extractPackageFile };

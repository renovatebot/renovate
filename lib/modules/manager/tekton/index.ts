import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const url = 'https://tekton.dev/docs';
export const categories: Category[] = ['ci', 'cd'];

export const defaultConfig = {
  managerFilePatterns: [],
};

export const supportedDatasources = [DockerDatasource.id, GitTagsDatasource.id];

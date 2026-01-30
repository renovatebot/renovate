import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { extractAllPackageFiles, extractPackageFile } from './extract.ts';

export { extractAllPackageFiles, extractPackageFile };

export const url = 'https://batect.dev/docs';
export const categories: Category[] = ['batect'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)batect(-bundle)?\\.ya?ml$/'],
};

export const supportedDatasources = [DockerDatasource.id, GitTagsDatasource.id];

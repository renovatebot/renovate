import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'Rancher Fleet';
export const url = 'https://fleet.rancher.io';
export const categories: Category[] = ['cd', 'kubernetes'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)fleet\\.ya?ml/'],
};

export const supportedDatasources = [
  GitTagsDatasource.id,
  HelmDatasource.id,
  DockerDatasource.id,
];

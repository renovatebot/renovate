import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'Argo CD';
export const url = 'https://argo-cd.readthedocs.io';
export const categories: Category[] = ['kubernetes', 'cd'];

export const defaultConfig = {
  managerFilePatterns: [],
};

export const supportedDatasources = [
  DockerDatasource.id,
  GitTagsDatasource.id,
  HelmDatasource.id,
];

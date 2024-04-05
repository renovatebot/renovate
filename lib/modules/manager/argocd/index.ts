import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';

export { extractPackageFile } from './extract';

export const displayName = 'Argo CD';
export const url = 'https://argo-cd.readthedocs.io/';

export const defaultConfig = {
  fileMatch: [],
};

export const categories: Category[] = ['kubernetes', 'cd'];

export const supportedDatasources = [
  DockerDatasource.id,
  GitTagsDatasource.id,
  HelmDatasource.id,
];

import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';

export { extractPackageFile } from './extract';

export const displayName = 'Rancher Fleet';

export const defaultConfig = {
  fileMatch: ['(^|/)fleet\\.ya?ml'],
};

export const categories: Category[] = ['cd', 'kubernetes'];

export const supportedDatasources = [
  GitTagsDatasource.id,
  HelmDatasource.id,
  DockerDatasource.id,
];

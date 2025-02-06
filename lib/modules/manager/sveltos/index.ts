import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';

export { extractPackageFile } from './extract';

export const url = 'https://projectsveltos.github.io/sveltos';
export const categories: Category[] = ['kubernetes', 'cd'];

export const defaultConfig = {
  fileMatch: [],
};

export const supportedDatasources = [DockerDatasource.id, HelmDatasource.id];

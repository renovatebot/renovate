import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://projectsveltos.github.io/sveltos';
export const categories: Category[] = ['kubernetes', 'cd'];

export const defaultConfig = {
  managerFilePatterns: [],
};

export const supportedDatasources = [DockerDatasource.id, HelmDatasource.id];

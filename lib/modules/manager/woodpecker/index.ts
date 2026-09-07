import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { extractPackageFile } from './extract.ts';

export { extractPackageFile };

export const url = 'https://woodpecker-ci.org';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/^\\.woodpecker(?:/[^/]+)?\\.ya?ml$/'],
};

export const supportedDatasources: DatasourceName[] = [DockerDatasource.id];

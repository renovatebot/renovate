import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { extractPackageFile } from './extract.ts';

export { extractPackageFile };

export const displayName = 'Cloud Build';
export const url = 'https://cloud.google.com/build/docs';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)cloudbuild\\.ya?ml/'],
};

export const supportedDatasources: DatasourceName[] = [DockerDatasource.id];

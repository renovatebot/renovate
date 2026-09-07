import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'runtime.txt';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)runtime.txt$/'],
  pinDigests: false,
};

export const supportedDatasources: DatasourceName[] = [DockerDatasource.id];

import type { Category } from '../../../constants/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';

export const categories: Category[] = ['java'];

export { extractPackageFile } from './extract.ts';

export const displayName = 'OSGi';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)src/main/features/.+\\.json$/'],
};

export const supportedDatasources = [MavenDatasource.id];

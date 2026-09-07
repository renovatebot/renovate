import type { Category } from '../../../constants/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'Smithy';
export const url = 'https://smithy.io/2.0/guides/smithy-build-json.html';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)smithy-build\\.json$/'],
};

export const supportedDatasources = [MavenDatasource.id];

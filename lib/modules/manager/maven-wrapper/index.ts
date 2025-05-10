import type { Category } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import { id as versioning } from '../../versioning/maven';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const url = 'https://maven.apache.org/wrapper';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|\\/).mvn/wrapper/maven-wrapper.properties$/'],
  versioning,
};

export const supportedDatasources = [MavenDatasource.id];

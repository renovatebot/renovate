import type { Category } from '../../../constants/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import { id as versioning } from '../../versioning/maven/index.ts';

export { extractPackageFile } from './extract.ts';
export { updateArtifacts } from './artifacts.ts';

export const url = 'https://maven.apache.org/tools/wrapper';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|\\/).mvn/wrapper/maven-wrapper.properties$/',
    '/(^|\\/)mvnw(.cmd)?$/',
  ],
  versioning,
};

export const supportedDatasources = [MavenDatasource.id];

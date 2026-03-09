import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';

export { extractAllPackageFiles } from './extract.ts';
export { bumpPackageVersion, updateDependency } from './update.ts';

export const url = 'https://maven.apache.org';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/|\\.)pom\\.xml$/',
    '/^(((\\.mvn)|(\\.m2))/)?settings\\.xml$/',
    '/(^|/)\\.mvn/extensions\\.xml$/',
  ],
};

export const supportedDatasources = [MavenDatasource.id, DockerDatasource.id];

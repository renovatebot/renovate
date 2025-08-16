import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { MavenDatasource } from '../../datasource/maven';

export { extractAllPackageFiles } from './extract';
export { bumpPackageVersion, updateDependency } from './update';

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

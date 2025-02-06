import type { Category } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as mavenVersioning from '../../versioning/maven';

export { extractAllPackageFiles } from './extract';
export { bumpPackageVersion, updateDependency } from './update';

export const url = 'https://maven.apache.org';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  fileMatch: [
    '(^|/|\\.)pom\\.xml$',
    '^(((\\.mvn)|(\\.m2))/)?settings\\.xml$',
    '(^|/)\\.mvn/extensions\\.xml$',
  ],
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

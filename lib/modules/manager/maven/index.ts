import type { Category } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as mavenVersioning from '../../versioning/maven';

export { extractAllPackageFiles } from './extract';
export { bumpPackageVersion, updateDependency } from './update';

export const defaultConfig = {
  fileMatch: ['(^|/|\\.)pom\\.xml$', '^(((\\.mvn)|(\\.m2))/)?settings\\.xml$'],
  versioning: mavenVersioning.id,
};

export const categories: Category[] = ['java'];

export const supportedDatasources = [MavenDatasource.id];

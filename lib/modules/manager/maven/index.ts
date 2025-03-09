import os from 'node:os';
import type { Category } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as mavenVersioning from '../../versioning/maven';

export { extractAllPackageFiles } from './extract';
export { bumpPackageVersion, updateDependency } from './update';

export const url = 'https://maven.apache.org';
export const categories: Category[] = ['java'];

const homedir = os.homedir();

export const defaultConfig = {
  fileMatch: [
    '(^|/|\\.)pom\\.xml$',
    '^(((\\.mvn)|(\\.m2))/)?settings\\.xml$',
    '(^|/)\\.mvn/extensions\\.xml$',
    '^' + homedir + '/settings\\.xml$',
  ],
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

import type { ProgrammingLanguage } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as mavenVersioning from '../../versioning/maven';

export { extractAllPackageFiles } from './extract';
export { bumpPackageVersion, updateDependency } from './update';

export const language: ProgrammingLanguage = 'java';

export const defaultConfig = {
  fileMatch: ['(^|/|\\.)pom\\.xml$', '^(((\\.mvn)|(\\.m2))/)?settings\\.xml$'],
  filePatterns: [
    '**/pom.xml',
    '**/*.pom.xml',
    'settings.xml',
    '**/.mvn/settings.xml',
    '**/.m2/settings.xml',
  ], // not used yet
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

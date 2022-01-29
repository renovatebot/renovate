import { ProgrammingLanguage } from '../../constants';
import * as datasourceMaven from '../../datasource/maven';
import * as mavenVersioning from '../../versioning/maven';

export { extractAllPackageFiles } from './extract';
export { updateDependency } from './update';

export const language = ProgrammingLanguage.Java;

export const defaultConfig = {
  fileMatch: ['(^|/|\\.)pom\\.xml$', '^(((\\.mvn)|(\\.m2))/)?settings\\.xml$'],
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [datasourceMaven.id];

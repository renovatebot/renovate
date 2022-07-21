export { extractPackageFile } from './extract';

import { ProgrammingLanguage } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as gradleVersioning from '../../versioning/gradle';

export const language = ProgrammingLanguage.Kotlin;

export const defaultConfig = {
  fileMatch: ['^.*\\.kts$'],
  versioning: gradleVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

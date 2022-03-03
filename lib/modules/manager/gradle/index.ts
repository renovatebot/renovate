import { ProgrammingLanguage } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as gradleVersioning from '../../versioning/gradle';

export { extractAllPackageFiles } from './shallow/extract';
export { updateDependency } from './shallow/update';

export const language = ProgrammingLanguage.Java;

export const defaultConfig = {
  fileMatch: [
    '\\.gradle(\\.kts)?$',
    '(^|\\/)gradle\\.properties$',
    '(^|\\/)gradle\\/.+\\.toml$',
    '\\.versions\\.toml$',
  ],
  timeout: 600,
  versioning: gradleVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

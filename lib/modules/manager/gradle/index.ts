import type { ProgrammingLanguage } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as gradleVersioning from '../../versioning/gradle';

export { extractAllPackageFiles } from './extract';
export { updateDependency } from './update';
export { updateArtifacts } from './artifacts';

export const language: ProgrammingLanguage = 'java';
export const supportsLockFileMaintenance = true;

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

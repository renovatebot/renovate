import type { ProgrammingLanguage } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as gradleVersioning from '../../versioning/gradle';
import {
  VERSIONS_LOCK,
  VERSIONS_PROPS,
} from './extract/consistentVersionsPlugin';

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
    // The two below is for gradle-consistent-versions plugin
    `^${VERSIONS_PROPS}$`,
    `^${VERSIONS_LOCK}$`,
  ],
  timeout: 600,
  versioning: gradleVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

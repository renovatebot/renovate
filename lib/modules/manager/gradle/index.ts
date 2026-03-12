import type { Category } from '../../../constants/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import * as gradleVersioning from '../../versioning/gradle/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractAllPackageFiles } from './extract.ts';
export { updateDependency } from './update.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['gradle.lockfile'];

export const url =
  'https://docs.gradle.org/current/userguide/getting_started_dep_man.html';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: [
    '/\\.gradle(\\.kts)?$/',
    '/(^|/)gradle\\.properties$/',
    '/(^|/)gradle/.+\\.toml$/',
    '/(^|/)buildSrc/.+\\.kt$/',
    '/\\.versions\\.toml$/',
    // The two below is for gradle-consistent-versions plugin
    `/(^|/)versions.props$/`,
    `/(^|/)versions.lock$/`,
  ],
  timeout: 600,
  versioning: gradleVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

import type { Category } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as gradleVersioning from '../../versioning/gradle';

export { extractAllPackageFiles } from './extract';
export { updateDependency } from './update';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: [
    '\\.gradle(\\.kts)?$',
    '(^|/)gradle\\.properties$',
    '(^|/)gradle/.+\\.toml$',
    '(^|/)buildSrc/.+\\.kt$',
    '\\.versions\\.toml$',
    // The two below is for gradle-consistent-versions plugin
    `(^|/)versions.props$`,
    `(^|/)versions.lock$`,
  ],
  timeout: 600,
  versioning: gradleVersioning.id,
};

export const categories: Category[] = ['java'];

export const supportedDatasources = [MavenDatasource.id];

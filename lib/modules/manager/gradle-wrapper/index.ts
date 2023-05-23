import { GradleVersionDatasource } from '../../datasource/gradle-version';
import { id as versioning } from '../../versioning/gradle';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|/)gradle/wrapper/gradle-wrapper\\.properties$'],
  filePatterns: ['**/gradle/wrapper/gradle-wrapper.properties'], // not used yet
  versioning,
};

export const supportedDatasources = [GradleVersionDatasource.id];

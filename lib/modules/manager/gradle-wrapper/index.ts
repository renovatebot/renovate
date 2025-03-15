import type { Category } from '../../../constants';
import { GradleVersionDatasource } from '../../datasource/gradle-version';
import { id as versioning } from '../../versioning/gradle';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const url =
  'https://docs.gradle.org/current/userguide/gradle_wrapper.html';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  fileMatch: ['(^|/)gradle/wrapper/gradle-wrapper\\.properties$'],
  versioning,
};

export const supportedDatasources = [GradleVersionDatasource.id];

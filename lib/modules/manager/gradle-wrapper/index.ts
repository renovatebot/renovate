import type { Category } from '../../../constants/index.ts';
import { GradleVersionDatasource } from '../../datasource/gradle-version/index.ts';
import { id as versioning } from '../../versioning/gradle/index.ts';

export { extractPackageFile } from './extract.ts';
export { updateArtifacts } from './artifacts.ts';

export const url =
  'https://docs.gradle.org/current/userguide/gradle_wrapper.html';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)gradle/wrapper/gradle-wrapper\\.properties$/'],
  versioning,
};

export const supportedDatasources = [GradleVersionDatasource.id];

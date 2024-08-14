import type { Category } from '../../../constants';
import { GradleVersionDatasource } from '../../datasource/gradle-version';
import { JavaVersionDatasource } from '../../datasource/java-version';
import { MavenDatasource } from '../../datasource/maven';
import * as ivyVersioning from '../../versioning/ivy';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['^\\.sdkmanrc$'],
};

export const categories: Category[] = ['java'];

export const supportedDatasources = [
  JavaVersionDatasource.id,
  MavenDatasource.id,
  GradleVersionDatasource.id,
  ivyVersioning.id,
];

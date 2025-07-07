import type { Category } from '../../../constants';
import { ClojureDatasource } from '../../datasource/clojure';
import * as mavenVersioning from '../../versioning/maven';

export { extractPackageFile } from './extract';

export const url = 'https://leiningen.org';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)project\\.clj$/'],
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [ClojureDatasource.id];

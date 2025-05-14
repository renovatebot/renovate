import type { Category } from '../../../constants';
import { ClojureDatasource } from '../../datasource/clojure';
import * as mavenVersioning from '../../versioning/maven';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const displayName = 'deps.edn';
export const url = 'https://clojure.org/reference/deps_edn';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)(?:deps|bb)\\.edn$/'],
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [ClojureDatasource.id];

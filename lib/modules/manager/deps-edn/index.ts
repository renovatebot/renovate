import type { Category } from '../../../constants';
import { ClojureDatasource } from '../../datasource/clojure';
import * as mavenVersioning from '../../versioning/maven';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)(?:deps|bb)\\.edn$'],
  versioning: mavenVersioning.id,
};

export const categories: Category[] = ['java'];

export const supportedDatasources = [ClojureDatasource.id];

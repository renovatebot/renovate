import { ClojureDatasource } from '../../datasource/clojure';
import * as mavenVersioning from '../../versioning/maven';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)(?:deps|bb)\\.edn$'],
  filePatterns: ['**/deps.edn', '**/bb.edn'], // not used yet
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [ClojureDatasource.id];

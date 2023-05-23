import { ClojureDatasource } from '../../datasource/clojure';
import * as mavenVersioning from '../../versioning/maven';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)project\\.clj$'],
  filePatterns: ['**/project.clj'], // not used yet
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [ClojureDatasource.id];

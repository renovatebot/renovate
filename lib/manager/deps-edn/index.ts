import { ClojureDatasource } from '../../datasource/clojure';
import * as mavenVersioning from '../../modules/versioning/maven';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)deps\\.edn$'],
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [ClojureDatasource.id];

import { Category } from '../../../constants';
import { ClojureDatasource } from '../../datasource/clojure';
import * as mavenVersioning from '../../versioning/maven';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)project\\.clj$'],
  versioning: mavenVersioning.id,
};

export const categories = [Category.JVM];

export const supportedDatasources = [ClojureDatasource.id];

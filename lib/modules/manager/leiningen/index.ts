import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { ClojureDatasource } from '../../datasource/clojure/index.ts';
import * as mavenVersioning from '../../versioning/maven/index.ts';

export { knownDepTypes } from './dep-types.ts';
export { extractPackageFile } from './extract.ts';

export const url = 'https://leiningen.org';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)project\\.clj$/'],
  versioning: mavenVersioning.id,
};

export const supportedDatasources: DatasourceName[] = [ClojureDatasource.id];

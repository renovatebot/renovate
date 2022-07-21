export { extractPackageFile } from './extract';

import { MavenDatasource } from '../../datasource/maven';
import * as gradleVersioning from '../../versioning/gradle';

export const defaultConfig = {
  fileMatch: ['^.*\\.main\\.kts$'],
  versioning: gradleVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

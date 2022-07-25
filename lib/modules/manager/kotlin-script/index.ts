export { extractPackageFile } from './extract';

import { MavenDatasource } from '../../datasource/maven';
import * as mavenVersioning from '../../versioning/maven';

export const defaultConfig = {
  fileMatch: ['^.*\\.main\\.kts$'],
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

import { MavenDatasource } from '../../datasource/maven';
import * as mavenVersioning from '../../versioning/maven';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['^.*\\.main\\.kts$'],
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

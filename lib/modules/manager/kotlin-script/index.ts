import { MavenDatasource } from '../../datasource/maven';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['^.+\\.main\\.kts$'],
};

export const supportedDatasources = [MavenDatasource.id];

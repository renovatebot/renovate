import { MavenDatasource } from '../../datasource/maven';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['^.+\\.main\\.kts$'],
  filePatterns: ['**/*.main.kts'], // not used yet
};

export const supportedDatasources = [MavenDatasource.id];

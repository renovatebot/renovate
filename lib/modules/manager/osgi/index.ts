import { MavenDatasource } from '../../datasource/maven';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)src/main/features/.+\\.json$'],
};

export const supportedDatasources = [MavenDatasource.id];

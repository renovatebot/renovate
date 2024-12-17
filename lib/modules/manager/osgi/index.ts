import { MavenDatasource } from '../../datasource/maven';

export { extractPackageFile } from './extract';

export const displayName = 'OSGi';

export const defaultConfig = {
  fileMatch: ['(^|/)src/main/features/.+\\.json$'],
};

export const supportedDatasources = [MavenDatasource.id];

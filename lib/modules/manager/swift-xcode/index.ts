import { GitTagsDatasource } from '../../datasource/git-tags';
import * as swiftVersioning from '../../versioning/swift';

export { extractPackageFile } from './extract';

export const supportedDatasources = [GitTagsDatasource.id];

export const defaultConfig = {
  fileMatch: ['/project\\.pbxproj$'],
  versioning: swiftVersioning.id,
  rangeStrategy: 'bump',
};

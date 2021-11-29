import * as swiftVersioning from '../../versioning/swift';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)Package\\.swift'],
  versioning: swiftVersioning.id,
  rangeStrategy: 'bump',
};

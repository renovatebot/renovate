import * as swiftVersioning from '../../versioning/swift';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  fileMatch: ['(^|/)Package\\.swift'],
  versioning: swiftVersioning.id,
  rangeStrategy: 'bump',
};

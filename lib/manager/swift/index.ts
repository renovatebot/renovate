import { VERSION_SCHEME_SWIFT } from '../../constants/version-schemes';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  fileMatch: ['(^|/)Package\\.swift'],
  versionScheme: VERSION_SCHEME_SWIFT,
  rangeStrategy: 'bump',
};

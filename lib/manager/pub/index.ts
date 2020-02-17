import { VERSION_SCHEME_NPM } from '../../constants/version-schemes';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  fileMatch: ['(^|/)pubspec\\.ya?ml$'],
  versioning: VERSION_SCHEME_NPM,
};

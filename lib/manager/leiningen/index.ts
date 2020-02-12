import { VERSION_SCHEME_MAVEN } from '../../constants/version-schemes';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  fileMatch: ['(^|/)project\\.clj$'],
  versionScheme: VERSION_SCHEME_MAVEN,
};

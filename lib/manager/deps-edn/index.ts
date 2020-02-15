import { VERSION_SCHEME_MAVEN } from '../../constants/version-schemes';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export { extractPackageFile, updateDependency };

export const defaultConfig = {
  fileMatch: ['(^|/)deps\\.edn$'],
  versionScheme: VERSION_SCHEME_MAVEN,
};

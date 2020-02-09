import { VERSION_SCHEME_SEMVER } from '../../constants/version-schemes';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export { extractPackageFile, updateDependency };

export const defaultConfig = {
  fileMatch: [],
  versionScheme: VERSION_SCHEME_SEMVER,
};

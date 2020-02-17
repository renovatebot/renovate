import { extractPackageFile } from './extract';
import { updateDependency } from './update';
import { VERSION_SCHEME_SEMVER } from '../../constants/version-schemes';

export { extractPackageFile, updateDependency };

export const defaultConfig = {
  fileMatch: ['\\.html?$'],
  versioning: VERSION_SCHEME_SEMVER,
};

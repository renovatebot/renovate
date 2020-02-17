import { LANGUAGE_NODE } from '../../constants/languages';
import { VERSION_SCHEME_NODE } from '../../constants/version-schemes';

export { extractPackageFile } from './extract';
export { getPackageUpdates } from './package';
export { updateDependency } from './update';

export const language = LANGUAGE_NODE;

export const defaultConfig = {
  fileMatch: ['^.travis.yml$'],
  versioning: VERSION_SCHEME_NODE,
};

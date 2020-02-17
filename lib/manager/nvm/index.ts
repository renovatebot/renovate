import { LANGUAGE_NODE } from '../../constants/languages';
import { VERSION_SCHEME_NODE } from '../../constants/version-schemes';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const language = LANGUAGE_NODE;

export const defaultConfig = {
  fileMatch: ['^.nvmrc$'],
  versioning: VERSION_SCHEME_NODE,
};

import { LANGUAGE_RUBY } from '../../constants/languages';
import { VERSION_SCHEME_RUBY } from '../../constants/version-schemes';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const language = LANGUAGE_RUBY;

export const defaultConfig = {
  fileMatch: ['(^|/)\\.ruby-version$'],
  versioning: VERSION_SCHEME_RUBY,
};

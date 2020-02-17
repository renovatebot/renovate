import { LANGUAGE_JAVA } from '../../constants/languages';
import { VERSION_SCHEME_MAVEN } from '../../constants/version-schemes';

export { extractAllPackageFiles } from './extract';
export { updateDependency } from './update';

export const language = LANGUAGE_JAVA;

export const defaultConfig = {
  fileMatch: ['\\.pom\\.xml$', '(^|/)pom\\.xml$'],
  versioning: VERSION_SCHEME_MAVEN,
};

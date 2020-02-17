import { LANGUAGE_JAVA } from '../../constants/languages';
import * as mavenVersioning from '../../versioning/maven';

export { extractAllPackageFiles } from './extract';
export { updateDependency } from './update';

export const language = LANGUAGE_JAVA;

export const defaultConfig = {
  fileMatch: ['\\.pom\\.xml$', '(^|/)pom\\.xml$'],
  versioning: mavenVersioning.id,
};

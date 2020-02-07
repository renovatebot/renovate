import { extractPackageFile } from './extract';
import { updateDependency } from './update';
import { LANGUAGE_DOCKER } from '../../constants/languages';

const language = LANGUAGE_DOCKER;

export { extractPackageFile, language, updateDependency };

export const defaultConfig = {
  fileMatch: ['(^|/)Dockerfile$', '(^|/)Dockerfile\\.[^/]*$'],
};

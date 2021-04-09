import { LANGUAGE_DOCKER } from '../../constants/languages';
import { extractPackageFile } from './extract';

const language = LANGUAGE_DOCKER;

export { extractPackageFile, language };

export const defaultConfig = {
  fileMatch: ['^\\.github\\/workflows\\/[^/]+\\.ya?ml$'],
};

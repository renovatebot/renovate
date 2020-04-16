import { extractPackageFile } from './extract';
import { LANGUAGE_DOCKER } from '../../constants/languages';

const language = LANGUAGE_DOCKER;

export { extractPackageFile, language };

export const defaultConfig = {
  fileMatch: ['^\\.gitlab-ci\\.yml$'],
};

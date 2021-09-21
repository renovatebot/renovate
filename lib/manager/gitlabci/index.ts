import { LANGUAGE_DOCKER } from '../../constants/languages';
import { extractAllPackageFiles, extractPackageFile } from './extract';

const language = LANGUAGE_DOCKER;

export { extractAllPackageFiles, extractPackageFile, language };

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.yml$'],
};

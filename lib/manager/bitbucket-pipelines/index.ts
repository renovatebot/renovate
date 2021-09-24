import { LANGUAGE_DOCKER } from '../../constants/languages';
import { extractPackageFile } from './extract';

export { extractPackageFile, language };

export const defaultConfig = {
  fileMatch: ['(^|/)\\.bitbucket-pipelines\\.yaml$'],
};

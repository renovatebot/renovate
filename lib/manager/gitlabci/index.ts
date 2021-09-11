import { ProgrammingLanguage } from '../../constants/programming-language';
import { extractAllPackageFiles, extractPackageFile } from './extract';

const language = ProgrammingLanguage.Docker;

export { extractAllPackageFiles, extractPackageFile, language };

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.yml$'],
};

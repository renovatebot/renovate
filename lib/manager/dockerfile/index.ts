import { ProgrammingLanguage } from '../../constants/programming-language';
import { extractPackageFile } from './extract';

const language = ProgrammingLanguage.Docker;

export { extractPackageFile, language };

export const defaultConfig = {
  fileMatch: ['(^|/|\\.)Dockerfile$', '(^|/)Dockerfile\\.[^/]*$'],
};

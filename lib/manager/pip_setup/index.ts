import { ProgrammingLanguage } from '../../constants/programming-language';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Python;

export const defaultConfig = {
  fileMatch: ['(^|/)setup.py$'],
};

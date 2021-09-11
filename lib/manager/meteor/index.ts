import { ProgrammingLanguage } from '../../constants/programming-language';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.JavaScript;

export const defaultConfig = {
  fileMatch: ['(^|/)package.js$'],
};

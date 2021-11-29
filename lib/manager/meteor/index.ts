import { ProgrammingLanguage } from '../../constants';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.JavaScript;

export const defaultConfig = {
  fileMatch: ['(^|/)package.js$'],
};

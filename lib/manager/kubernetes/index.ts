import { ProgrammingLanguage } from '../../constants/programming-language';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Docker;

export const defaultConfig = {
  fileMatch: [],
};

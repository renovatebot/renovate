import { ProgrammingLanguage } from '../../constants';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Python;

export const defaultConfig = {
  fileMatch: ['(^|/)setup.py$'],
};

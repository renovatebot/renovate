import { LANGUAGE_PYTHON } from '../../constants/languages';

export { extractPackageFile } from './extract';

export const language = LANGUAGE_PYTHON;

export const autoReplace = true;

export const defaultConfig = {
  fileMatch: ['(^|/)setup.py$'],
};

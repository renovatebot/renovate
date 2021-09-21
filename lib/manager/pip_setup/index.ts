import { LANGUAGE_PYTHON } from '../../constants/languages';

export { extractPackageFile } from './extract';

export const language = LANGUAGE_PYTHON;

export const defaultConfig = {
  fileMatch: ['(^|/)setup.py$'],
};

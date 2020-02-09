import { LANGUAGE_PYTHON } from '../../constants/languages';

export { extractPackageFile } from './extract';
export { updateDependency } from '../pip_requirements/update';

export const language = LANGUAGE_PYTHON;

export const defaultConfig = {
  fileMatch: ['(^|/)setup.py$'],
};

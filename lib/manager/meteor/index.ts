import { LANGUAGE_JAVASCRIPT } from '../../constants/languages';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const language = LANGUAGE_JAVASCRIPT;

export const defaultConfig = {
  fileMatch: ['(^|/)package.js$'],
};

import { LANGUAGE_PYTHON } from '../../constants/languages';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';
export { getRangeStrategy } from './range';

export const language = LANGUAGE_PYTHON;

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)requirements.(txt|pip)$'],
};

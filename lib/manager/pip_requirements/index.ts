import { LANGUAGE_PYTHON } from '../../constants/languages';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';
export { getRangeStrategy } from './range';

export const language = LANGUAGE_PYTHON;

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)requirements.(txt|pip)$'],
};

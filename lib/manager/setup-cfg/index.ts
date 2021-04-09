import { LANGUAGE_PYTHON } from '../../constants/languages';
import { id as versioning } from '../../versioning/pep440';

export { extractPackageFile } from './extract';
export { getRangeStrategy } from './range';

export const language = LANGUAGE_PYTHON;

export const defaultConfig = {
  fileMatch: ['(^|/)setup\\.cfg$'],
  versioning,
};
